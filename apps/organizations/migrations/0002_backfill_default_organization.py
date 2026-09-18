from django.db import migrations


def backfill_default_organization(apps, schema_editor):
    Organization = apps.get_model("organizations", "Organization")
    User = apps.get_model("accounts", "User")
    Service = apps.get_model("catalog", "Service")
    Order = apps.get_model("orders", "Order")
    CareContract = apps.get_model("care", "CareContract")
    SupportTicket = apps.get_model("support", "SupportTicket")
    EmployeeProfile = apps.get_model("staff", "EmployeeProfile")
    AdminProfile = apps.get_model("staff", "AdminProfile")

    org, _ = Organization.objects.get_or_create(
        slug="default",
        defaults={"name": "E-Makon", "is_active": True},
    )

    User.objects.filter(organization__isnull=True).exclude(role="superadmin").update(
        organization=org
    )
    Service.objects.filter(organization__isnull=True).update(organization=org)
    Order.objects.filter(organization__isnull=True).update(organization=org)
    CareContract.objects.filter(organization__isnull=True).update(organization=org)
    SupportTicket.objects.filter(organization__isnull=True).update(organization=org)
    EmployeeProfile.objects.filter(organization__isnull=True).update(organization=org)
    AdminProfile.objects.filter(organization__isnull=True).update(organization=org)

    # Ensure every admin role user has an AdminProfile (capabilities enforcement)
    for user in User.objects.filter(role="admin"):
        AdminProfile.objects.get_or_create(
            user=user,
            defaults={
                "organization_id": user.organization_id or org.pk,
                "title": "Admin",
                "can_manage_staff": True,
                "can_manage_orders": True,
                "can_view_analytics": True,
                "is_active": True,
            },
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("organizations", "0001_organization_tenancy"),
        ("accounts", "0003_organization_tenancy"),
        ("catalog", "0003_organization_tenancy"),
        ("orders", "0005_organization_tenancy"),
        ("care", "0002_organization_tenancy"),
        ("support", "0002_organization_tenancy"),
        ("staff", "0002_organization_tenancy"),
    ]

    operations = [
        migrations.RunPython(backfill_default_organization, noop_reverse),
    ]
