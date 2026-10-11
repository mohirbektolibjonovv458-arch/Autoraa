from rest_framework import serializers

from .models import Lesson, Question, Quiz, StudyGoal, StudyTask, VocabWord


class QuestionPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ["id", "text", "options", "topic"]


class QuestionFullSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ["id", "quiz", "text", "options", "correct_index", "explanation", "topic", "order"]

    def validate(self, attrs):
        opts = attrs.get("options", getattr(self.instance, "options", None))
        idx = attrs.get("correct_index", getattr(self.instance, "correct_index", None))
        if not isinstance(opts, list) or not 2 <= len(opts) <= 6 or not all(isinstance(o, str) and o.strip() for o in opts):
            raise serializers.ValidationError({"options": "2–6 ta bo'sh bo'lmagan variant kiriting."})
        if idx is None or idx >= len(opts):
            raise serializers.ValidationError({"correct_index": "To'g'ri javob indeksi variantlar orasida bo'lishi kerak."})
        return attrs


class QuizSerializer(serializers.ModelSerializer):
    question_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Quiz
        fields = ["id", "title", "subject", "topic", "level", "description", "time_limit_seconds", "is_premium", "is_published", "question_count", "owner", "created"]
        read_only_fields = ["owner"]


class LessonListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ["id", "title", "skill", "level", "summary", "is_premium", "order", "quiz"]


class LessonAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = "__all__"


class VocabSerializer(serializers.ModelSerializer):
    class Meta:
        model = VocabWord
        fields = ["id", "word", "translation", "example", "reps", "interval_days", "due", "created"]
        read_only_fields = ["reps", "interval_days", "due", "created"]

    def validate_word(self, v):
        v = v.strip()
        if not v:
            raise serializers.ValidationError("So'zni kiriting.")
        return v


class GoalSerializer(serializers.ModelSerializer):
    progress = serializers.SerializerMethodField()

    class Meta:
        model = StudyGoal
        fields = ["id", "title", "kind", "target", "current_level", "deadline", "minutes_per_day", "status", "created", "progress"]
        read_only_fields = ["created"]

    def get_progress(self, g):
        tasks = g.tasks.all()
        total = len(tasks)
        return {"done": sum(1 for t in tasks if t.done), "total": total}

    def validate_minutes_per_day(self, v):
        if not 10 <= v <= 480:
            raise serializers.ValidationError("10–480 daqiqa oralig'ida.")
        return v


class TaskSerializer(serializers.ModelSerializer):
    goal_title = serializers.CharField(source="goal.title", read_only=True, default=None)

    class Meta:
        model = StudyTask
        fields = ["id", "goal", "goal_title", "title", "details", "date", "minutes", "link", "source", "done", "done_at"]
        read_only_fields = ["source", "done_at"]

    def validate_goal(self, g):
        if g and g.user_id != self.context["request"].user.id:
            raise serializers.ValidationError("Maqsad topilmadi.")
        return g

    def validate_minutes(self, v):
        if not 5 <= v <= 300:
            raise serializers.ValidationError("5–300 daqiqa oralig'ida.")
        return v

    def validate_link(self, v):
        if v and not v.startswith("/"):
            raise serializers.ValidationError("Havola ilova ichidagi yo'l bo'lishi kerak.")
        return v
