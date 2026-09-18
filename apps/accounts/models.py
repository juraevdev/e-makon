from __future__ import annotations

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel
from apps.core.phone import normalize_phone


class UserManager(BaseUserManager):
    def create_user(self, phone: str, password: str | None = None, **extra_fields):
        if not phone:
            raise ValueError("Phone is required")
        phone = normalize_phone(phone)
        user = self.model(phone=phone, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, phone: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.SUPERADMIN)
        extra_fields.setdefault("is_active", True)
        if not password:
            raise ValueError("Superuser must have a password")
        return self.create_user(phone, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        CUSTOMER = "customer", "Mijoz"
        WORKER = "worker", "Xodim"
        ADMIN = "admin", "Admin"
        SUPERADMIN = "superadmin", "Superadmin"

    phone = models.CharField(max_length=32, unique=True, db_index=True)
    first_name = models.CharField(max_length=120, blank=True)
    last_name = models.CharField(max_length=120, blank=True)
    # Kept in sync with first_name + last_name for search / legacy clients
    full_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.CUSTOMER, db_index=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    birth_date = models.DateField(blank=True, null=True)

    home_address = models.CharField(max_length=512, blank=True)
    country = models.CharField(max_length=120, blank=True)
    region = models.CharField(max_length=120, blank=True)
    district = models.CharField(max_length=120, blank=True)
    street = models.CharField(max_length=255, blank=True)
    location_lat = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    location_lng = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    additional_phones = models.JSONField(default=list, blank=True)
    loyalty_points = models.PositiveIntegerField(default=0)

    # Optional Telegram bridge (mygarden bot sync)
    telegram_id = models.BigIntegerField(unique=True, blank=True, null=True)
    telegram_username = models.CharField(max_length=255, blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        ordering = ["-date_joined"]
        verbose_name = "Foydalanuvchi"
        verbose_name_plural = "Foydalanuvchilar"

    def __str__(self) -> str:
        return self.display_name or self.phone

    def sync_full_name(self) -> None:
        parts = [self.first_name.strip(), self.last_name.strip()]
        joined = " ".join(p for p in parts if p)
        if joined:
            self.full_name = joined
        elif self.full_name and not self.first_name and not self.last_name:
            # Split legacy full_name once into first/last when possible
            chunks = self.full_name.strip().split(None, 1)
            if chunks:
                self.first_name = chunks[0]
                self.last_name = chunks[1] if len(chunks) > 1 else ""

    def save(self, *args, **kwargs):
        self.sync_full_name()
        super().save(*args, **kwargs)

    @property
    def display_name(self) -> str:
        return self.full_name or f"{self.first_name} {self.last_name}".strip()

    @property
    def formatted_address(self) -> str:
        parts = [self.country, self.region, self.district, self.street]
        joined = ", ".join(p.strip() for p in parts if p and p.strip())
        return joined or self.home_address

    @property
    def is_customer(self) -> bool:
        return self.role == self.Role.CUSTOMER

    @property
    def is_platform_admin(self) -> bool:
        return self.role in {self.Role.ADMIN, self.Role.SUPERADMIN}


class OTPChallenge(TimeStampedModel):
    class Purpose(models.TextChoices):
        LOGIN = "login", "Login"
        REGISTER = "register", "Register"
        VERIFY_PHONE = "verify_phone", "Verify phone"

    phone = models.CharField(max_length=32, db_index=True)
    code_hash = models.CharField(max_length=128)
    purpose = models.CharField(max_length=32, choices=Purpose.choices, default=Purpose.LOGIN)
    attempts = models.PositiveSmallIntegerField(default=0)
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["phone", "purpose", "is_used"]),
        ]

    def __str__(self) -> str:
        return f"OTP {self.phone} ({self.purpose})"

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at


class LoyaltySettings(models.Model):
    """Ball tizimi — bajarilgan buyurtma uchun hisoblash qoidalari."""

    uzs_per_point = models.PositiveIntegerField(default=100_000)
    min_redeem_points = models.PositiveIntegerField(default=50)
    expire_months = models.PositiveSmallIntegerField(default=12)

    class Meta:
        verbose_name = "Ball sozlamasi"
        verbose_name_plural = "Ball sozlamalari"

    def __str__(self) -> str:
        return f"1 ball = {self.uzs_per_point} so'm"

    @classmethod
    def get(cls) -> "LoyaltySettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class LoyaltyReward(TimeStampedModel):
    name = models.CharField(max_length=255)
    icon = models.CharField(max_length=64, default="redeem")
    points_cost = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "Ball mukofoti"
        verbose_name_plural = "Ball mukofotlari"

    def __str__(self) -> str:
        return f"{self.name} ({self.points_cost})"


class PointTransaction(TimeStampedModel):
    class Kind(models.TextChoices):
        EARN = "earn", "Hisobga olindi"
        REDEEM = "redeem", "Almashtirildi"
        EXPIRE = "expire", "Muddati o'tdi"
        ADJUST = "adjust", "Tuzatish"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="point_transactions",
    )
    kind = models.CharField(max_length=16, choices=Kind.choices)
    points = models.IntegerField()
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="point_transactions",
    )
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Ball tranzaksiyasi"
        verbose_name_plural = "Ball tranzaksiyalari"

    def __str__(self) -> str:
        return f"{self.user_id} {self.kind} {self.points}"
