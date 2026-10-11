from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core.paginate import paginate

from .matching import grant_match
from .models import ChecklistItem, FavoriteUniversity, Grant, SavedGrant, University
from .serializers import (ChecklistItemSerializer, GrantSerializer, SavedGrantSerializer,
                          UniversityDetailSerializer, UniversityListSerializer)


def fav_ids(user):
    return set(FavoriteUniversity.objects.filter(user=user).values_list("university_id", flat=True))


def _int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


@api_view(["GET"])
def university_list(request):
    qs = University.objects.filter(is_published=True).prefetch_related("programs")
    p = request.query_params
    if q := p.get("q", "").strip()[:100]:
        qs = qs.filter(Q(name__icontains=q) | Q(short_name__icontains=q) | Q(city__icontains=q) | Q(programs__name__icontains=q))
    for key in ("country", "city", "kind"):
        if v := p.get(key):
            qs = qs.filter(**{key: v})
    if v := p.get("field"):
        qs = qs.filter(programs__field=v)
    if v := p.get("language"):
        qs = qs.filter(languages__icontains=v)
    if (v := _int(p.get("max_tuition"))) is not None:
        qs = qs.filter(tuition_min__isnull=False, tuition_min__lte=v)
    if v := p.get("max_ielts"):
        try:
            qs = qs.filter(Q(ielts_min__isnull=True) | Q(ielts_min__lte=float(v)))
        except ValueError:
            pass
    if p.get("grants") == "1":
        qs = qs.filter(has_grants=True)
    if p.get("favorites") == "1":
        qs = qs.filter(favoriteuniversity__user=request.user)
    qs = qs.distinct()
    return paginate(request, qs, UniversityListSerializer, {"favorites": fav_ids(request.user)})


@api_view(["GET"])
def university_filters(request):
    qs = University.objects.filter(is_published=True)
    from .models import Program

    return Response({
        "countries": sorted(set(qs.values_list("country", flat=True))),
        "cities": sorted(set(qs.values_list("city", flat=True))),
        "fields": sorted(set(Program.objects.filter(university__is_published=True).values_list("field", flat=True))),
    })


@api_view(["GET"])
def university_detail(request, pk):
    u = get_object_or_404(University.objects.prefetch_related("programs"), pk=pk, is_published=True)
    return Response(UniversityDetailSerializer(u, context={"favorites": fav_ids(request.user)}).data)


@api_view(["POST", "DELETE"])
def university_favorite(request, pk):
    u = get_object_or_404(University, pk=pk, is_published=True)
    if request.method == "POST":
        FavoriteUniversity.objects.get_or_create(user=request.user, university=u)
        return Response({"is_favorite": True})
    FavoriteUniversity.objects.filter(user=request.user, university=u).delete()
    return Response({"is_favorite": False})


@api_view(["GET"])
def university_compare(request):
    ids = [i for i in (_int(x) for x in request.query_params.get("ids", "").split(",")) if i][:3]
    qs = University.objects.filter(pk__in=ids, is_published=True).prefetch_related("programs")
    return Response(UniversityDetailSerializer(qs, many=True, context={"favorites": fav_ids(request.user)}).data)


@api_view(["GET"])
def grant_list(request):
    qs = Grant.objects.filter(is_published=True)
    p = request.query_params
    if q := p.get("q", "").strip()[:100]:
        qs = qs.filter(Q(name__icontains=q) | Q(provider__icontains=q) | Q(country__icontains=q))
    if v := p.get("country"):
        qs = qs.filter(country=v)
    if v := p.get("funding"):
        qs = qs.filter(funding=v)
    if v := p.get("level"):
        qs = qs.filter(Q(levels__icontains=v) | Q(levels__icontains="any"))
    if p.get("open") == "1":
        qs = qs.filter(Q(deadline__isnull=True) | Q(deadline__gte=timezone.localdate()))
    saved = set(SavedGrant.objects.filter(user=request.user).values_list("grant_id", flat=True))
    items = []
    for g in qs:
        d = GrantSerializer(g).data
        d["match"] = grant_match(g, request.user)
        d["saved"] = g.id in saved
        items.append(d)
    if p.get("sort") == "match":
        order = {"good": 0, "partial": 1, "unknown": 2, "low": 3}
        items.sort(key=lambda x: order[x["match"]["level"]])
    return Response({"results": items, "countries": sorted(set(Grant.objects.filter(is_published=True).values_list("country", flat=True)))})


@api_view(["GET"])
def grant_detail(request, pk):
    g = get_object_or_404(Grant, pk=pk, is_published=True)
    d = GrantSerializer(g).data
    d["match"] = grant_match(g, request.user)
    saved = SavedGrant.objects.filter(user=request.user, grant=g).prefetch_related("checklist").first()
    d["saved"] = SavedGrantSerializer(saved).data if saved else None
    return Response(d)


@api_view(["POST", "DELETE"])
def grant_save(request, pk):
    g = get_object_or_404(Grant, pk=pk, is_published=True)
    if request.method == "DELETE":
        SavedGrant.objects.filter(user=request.user, grant=g).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    saved, created = SavedGrant.objects.get_or_create(user=request.user, grant=g)
    if created:
        ChecklistItem.objects.bulk_create([ChecklistItem(saved=saved, title=t[:200], order=i) for i, t in enumerate(g.documents or [])])
        ChecklistItem.objects.create(saved=saved, title="Rasmiy saytda talablar va muddatni tekshirish", order=99)
    return Response(SavedGrantSerializer(SavedGrant.objects.prefetch_related("checklist").get(pk=saved.pk)).data, status=201 if created else 200)


@api_view(["GET"])
def saved_grants(request):
    qs = SavedGrant.objects.filter(user=request.user).select_related("grant").prefetch_related("checklist")
    return Response(SavedGrantSerializer(qs, many=True).data)


@api_view(["PATCH"])
def saved_grant_update(request, pk):
    s = get_object_or_404(SavedGrant, pk=pk, user=request.user)
    st = request.data.get("status")
    if st not in dict(SavedGrant.STATUSES):
        return Response({"status": "Noto'g'ri holat."}, status=400)
    s.status = st
    s.save(update_fields=["status"])
    return Response(SavedGrantSerializer(s).data)


@api_view(["POST"])
def checklist_add(request, pk):
    s = get_object_or_404(SavedGrant, pk=pk, user=request.user)
    if s.checklist.count() >= 40:
        return Response({"detail": "Ro'yxat juda uzun (40 tadan ko'p)."}, status=400)
    ser = ChecklistItemSerializer(data={"title": request.data.get("title", ""), "order": s.checklist.count() + 1})
    ser.is_valid(raise_exception=True)
    ser.save(saved=s)
    return Response(ser.data, status=201)


@api_view(["PATCH", "DELETE"])
def checklist_item(request, pk):
    item = get_object_or_404(ChecklistItem, pk=pk, saved__user=request.user)
    if request.method == "DELETE":
        item.delete()
        return Response(status=204)
    ser = ChecklistItemSerializer(item, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(ser.data)
