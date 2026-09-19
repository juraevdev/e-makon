from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.analytics.views import DashboardView
from apps.care.views import AdminCareContractViewSet, CustomerCareContractViewSet
from apps.catalog.views import AdminServiceViewSet, ServiceViewSet
from apps.orders.views import AdminOrderViewSet, CustomerOrderViewSet
from apps.staff.views import AdminUserViewSet, EmployeeViewSet
from apps.support.views import AdminSupportTicketViewSet, CustomerSupportTicketViewSet

customer_router = DefaultRouter()
customer_router.register("services", ServiceViewSet, basename="service")
customer_router.register("orders", CustomerOrderViewSet, basename="order")
customer_router.register("care-contracts", CustomerCareContractViewSet, basename="care-contract")
customer_router.register("support", CustomerSupportTicketViewSet, basename="support")

admin_router = DefaultRouter()
admin_router.register("services", AdminServiceViewSet, basename="admin-service")
admin_router.register("orders", AdminOrderViewSet, basename="admin-order")
admin_router.register("employees", EmployeeViewSet, basename="admin-employee")
admin_router.register("admins", AdminUserViewSet, basename="admin-user")
admin_router.register("care-contracts", AdminCareContractViewSet, basename="admin-care")
admin_router.register("support", AdminSupportTicketViewSet, basename="admin-support")

urlpatterns = [
    path("auth/", include("apps.accounts.urls")),
    path("", include(customer_router.urls)),
    path("admin/", include(admin_router.urls)),
    path("admin/dashboard/", DashboardView.as_view(), name="admin-dashboard"),
]
