from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.views import (
    AdminCustomerViewSet,
    LoyaltyRewardViewSet,
    LoyaltySettingsView,
    PointTransactionViewSet,
)
from apps.analytics.views import DashboardView, MapView, ReportBundleView
from apps.care.views import AdminCareContractViewSet, CustomerCareContractViewSet
from apps.catalog.views import AdminBannerViewSet, AdminServiceViewSet, PublicBannerViewSet, ServiceViewSet
from apps.finance.views import (
    FirmLedgerSummaryView,
    LedgerEntryViewSet,
    OrderEscrowViewSet,
    OrderFinanceActionView,
)
from apps.orders.views import AdminOrderViewSet, CustomerOrderViewSet
from apps.staff.views import AdminUserViewSet, EmployeeViewSet, InvestorViewSet, PartnerFirmViewSet
from apps.support.views import AdminSupportTicketViewSet, CustomerSupportTicketViewSet

customer_router = DefaultRouter()
customer_router.register("services", ServiceViewSet, basename="service")
customer_router.register("banners", PublicBannerViewSet, basename="banner")
customer_router.register("orders", CustomerOrderViewSet, basename="order")
customer_router.register("care-contracts", CustomerCareContractViewSet, basename="care-contract")
customer_router.register("support", CustomerSupportTicketViewSet, basename="support")

admin_router = DefaultRouter()
admin_router.register("services", AdminServiceViewSet, basename="admin-service")
admin_router.register("banners", AdminBannerViewSet, basename="admin-banner")
admin_router.register("orders", AdminOrderViewSet, basename="admin-order")
admin_router.register("employees", EmployeeViewSet, basename="admin-employee")
admin_router.register("firms", PartnerFirmViewSet, basename="admin-firm")
admin_router.register("investors", InvestorViewSet, basename="admin-investor")
admin_router.register("admins", AdminUserViewSet, basename="admin-user")
admin_router.register("customers", AdminCustomerViewSet, basename="admin-customer")
admin_router.register("care-contracts", AdminCareContractViewSet, basename="admin-care")
admin_router.register("support", AdminSupportTicketViewSet, basename="admin-support")
admin_router.register("loyalty-rewards", LoyaltyRewardViewSet, basename="admin-loyalty-reward")
admin_router.register("loyalty-transactions", PointTransactionViewSet, basename="admin-loyalty-tx")
admin_router.register("escrows", OrderEscrowViewSet, basename="admin-escrow")
admin_router.register("ledger", LedgerEntryViewSet, basename="admin-ledger")

urlpatterns = [
    path("auth/", include("apps.accounts.urls")),
    path("", include(customer_router.urls)),
    path("admin/", include(admin_router.urls)),
    path("admin/dashboard/", DashboardView.as_view(), name="admin-dashboard"),
    path("admin/map/", MapView.as_view(), name="admin-map"),
    path("admin/reports/bundle/", ReportBundleView.as_view(), name="admin-report-bundle"),
    path("admin/loyalty/settings/", LoyaltySettingsView.as_view(), name="admin-loyalty-settings"),
    path(
        "admin/orders/<int:order_id>/finance/<str:action_name>/",
        OrderFinanceActionView.as_view(),
        name="admin-order-finance",
    ),
    path(
        "admin/firms/<int:firm_id>/ledger/",
        FirmLedgerSummaryView.as_view(),
        name="admin-firm-ledger",
    ),
]
