from django.contrib import admin

from .models import Lesson, Question, Quiz, StudyGoal, StudyTask


class QuestionInline(admin.StackedInline):
    model = Question
    extra = 0


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ("title", "subject", "level", "is_premium", "owner")
    list_filter = ("subject", "level")
    inlines = [QuestionInline]


admin.site.register(Lesson)
admin.site.register(StudyGoal)
admin.site.register(StudyTask)
