"""Ustalar hikoyalari (story) API.

GET    /api/masters/stories/              — faol hikoyalar, usta bo'yicha guruhlangan (ko'rilmaganlar oldinda)
POST   /api/masters/stories/              — usta: yangi hikoya (rasm yoki video ≤60 s + matn)
PATCH  /api/masters/stories/<id>/         — o'z hikoyasini tahrirlash (matn va/yoki rasm/video)
DELETE /api/masters/stories/<id>/         — o'z hikoyasini o'chirish (admin — istalganini, moderatsiya)
POST   /api/masters/stories/<id>/view/    — ko'rildi (halqa kulrang bo'ladi)
24 soatdan keyin hikoya ro'yxatda chiqmaydi; fon jarayoni (purge_expired_stories) uni fayli bilan o'chiradi.
"""
from datetime import timedelta

from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from core.params import str_in
from core.uploads import MAX_VIDEO_SECONDS, check_image, check_video, mp4_duration

from .models import Story, StoryView


def _story_json(s, me, seen_ids, own):
    d = {"id": s.id, "image": s.image.url if s.image else None, "video": s.video.url if s.video else None,
         "kind": "video" if s.video else "image", "duration": s.duration, "caption": s.caption, "created_at": s.created_at,
         "expires_at": s.expires_at, "seen": s.id in seen_ids, "edited": bool(s.edited_at)}
    if own:
        d["views"] = getattr(s, "n_views", None) if getattr(s, "n_views", None) is not None else s.views.count()
    return d


def active_stories():
    return Story.objects.filter(expires_at__gt=timezone.now(), master__user__is_active=True)


def _media_in(request, required):
    """So'rovdagi rasm/video: tekshiradi. Qaytaradi: (image, video, duration, xato_javobi)."""
    image, video, duration = request.FILES.get("image"), request.FILES.get("video"), None
    if video:
        ext, err = check_video(video)
        if err:
            return None, None, None, Response({"detail": err}, status=400)
        video.name = "story" + ext  # kengaytma — faylning haqiqiy formati
        d = mp4_duration(video) if ext in (".mp4", ".mov") else None
        if d is None:
            try:
                d = float(request.data.get("duration") or 0)
            except (TypeError, ValueError):
                d = 0
        duration = max(1, min(MAX_VIDEO_SECONDS, round(d))) if d else None
    if image:
        err = check_image(image)
        if err:
            return None, None, None, Response({"detail": err}, status=400)
    if required and not image and not video:
        return None, None, None, Response({"detail": "Rasm yoki video tanlang."}, status=400)
    return image, video, duration, None


def _drop(f):
    if f:
        try:
            f.storage.delete(f.name)
        except Exception:
            pass


class StoryListView(APIView):
    def get(self, request):
        me = request.user
        qs = (active_stories().select_related("master__user").annotate(n_views=Count("views")).order_by("master_id", "created_at"))
        seen_ids = set(StoryView.objects.filter(user=me, story__in=qs).values_list("story_id", flat=True))
        groups = {}
        for s in qs:
            m = s.master
            own = m.user_id == me.id
            g = groups.setdefault(m.id, {"master_id": m.id, "name": m.title or m.user.full_name, "avatar": m.user.avatar.url if m.user.avatar else None,
                                         "is_verified": m.is_verified, "own": own, "stories": []})
            g["stories"].append(_story_json(s, me, seen_ids, own))
        out = list(groups.values())
        for g in out:
            g["latest_at"] = g["stories"][-1]["created_at"]
            g["all_seen"] = all(x["seen"] for x in g["stories"]) and not g["own"]
        # o'zinikidan keyin: ko'rilmaganlar (eng yangisi oldinda), so'ng ko'rilganlar
        out.sort(key=lambda g: (not g["own"], g["all_seen"], -g["latest_at"].timestamp()))
        return Response({"groups": out[:60], "can_post": me.role == "usta" and hasattr(me, "master"),
                         "lifetime_hours": Story.LIFETIME_HOURS})

    def post(self, request):
        me = request.user
        if me.role != "usta" or not hasattr(me, "master"):
            return Response({"detail": "Hikoyani faqat ustalar joylay oladi."}, status=403)
        image, video, duration, err = _media_in(request, required=True)
        if err:
            return err
        caption = str_in(request.data.get("caption"))
        if len(caption) > 200:
            return Response({"detail": "Matn 200 belgidan oshmasin."}, status=400)
        if active_stories().filter(master=me.master).count() >= Story.MAX_ACTIVE:
            return Response({"detail": f"Bir vaqtda ko'pi bilan {Story.MAX_ACTIVE} ta hikoya. Eskisini o'chiring yoki muddati tugashini kuting."}, status=400)
        s = Story.objects.create(master=me.master, image=image or None, video=video or None, duration=duration, caption=caption,
                                 expires_at=timezone.now() + timedelta(hours=Story.LIFETIME_HOURS))
        return Response(_story_json(s, me, set(), True), status=201)


class StoryDetailView(APIView):
    def get_own(self, request, pk, allow_admin=False):
        s = get_object_or_404(active_stories().select_related("master"), pk=pk)
        if s.master.user_id != request.user.id and not (allow_admin and request.user.role == "admin"):
            return None, Response({"detail": "Faqat o'z hikoyangizni o'zgartira olasiz."}, status=403)
        return s, None

    def patch(self, request, pk):
        s, err = self.get_own(request, pk)
        if err:
            return err
        fields = []
        if "caption" in request.data:
            caption = str_in(request.data.get("caption"))
            if len(caption) > 200:
                return Response({"detail": "Matn 200 belgidan oshmasin."}, status=400)
            s.caption = caption
            fields.append("caption")
        image, video, duration, err = _media_in(request, required=False)
        if err:
            return err
        old = []
        if video or image:  # media almashtirildi: video (+ muqova) yoki rasm
            old = [(f.storage, f.name) for f in (s.image, s.video) if f]
            s.image = image or None
            s.video = video or None
            s.duration = duration if video else None
            fields.append("media")
        if not fields:
            return Response({"detail": "O'zgarish yo'q."}, status=400)
        s.edited_at = timezone.now()
        s.save()  # muddat o'zgarmaydi — joylangan vaqtdan 24 soat
        for storage, name in old:
            storage.delete(name)
        return Response(_story_json(s, request.user, set(), True))

    def delete(self, request, pk):
        s, err = self.get_own(request, pk, allow_admin=True)
        if err:
            return err
        _drop(s.image)
        _drop(s.video)
        s.delete()
        return Response(status=204)


class StoryViewMark(APIView):
    def post(self, request, pk):
        s = get_object_or_404(active_stories(), pk=pk)
        if s.master.user_id != request.user.id:
            StoryView.objects.get_or_create(story=s, user=request.user)
        return Response({"ok": True})


def purge_expired_stories():
    """Muddati o'tgan hikoyalarni fayli bilan o'chiradi (fon jarayoni, 30 daqiqada bir). Qaytaradi: nechta."""
    n = 0
    for s in Story.objects.filter(expires_at__lte=timezone.now())[:500]:
        _drop(s.image)
        _drop(s.video)
        s.delete()
        n += 1
    return n
