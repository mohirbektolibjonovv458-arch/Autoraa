from django.contrib import admin

from .models import Grant, Program, SavedGrant, University


class ProgramInline(admin.TabularInline):
    model = Program
    extra = 0


@admin.register(University)
class UniversityAdmin(admin.ModelAdmin):
    list_display = ("name", "country", "city", "verified", "is_published")
    list_filter = ("country", "verified", "is_published")
    search_fields = ("name",)
    inlines = [ProgramInline]


@admin.register(Grant)
class GrantAdmin(admin.ModelAdmin):
    list_display = ("name", "country", "deadline", "verified", "is_published")
    list_filter = ("country", "verified")


admin.site.register(SavedGrant)
