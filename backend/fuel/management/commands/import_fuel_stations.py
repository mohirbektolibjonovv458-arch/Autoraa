from django.core.management.base import BaseCommand

from fuel.osm import import_osm


class Command(BaseCommand):
    help = "O'zbekistondagi yoqilg'i shoxobchalarini OpenStreetMap'dan import qilish (yoki Overpass eksport faylidan)"

    def add_arguments(self, parser):
        parser.add_argument("--file", help="overpass-turbo.eu dan yuklab olingan JSON fayl (server Overpass'ga ulana olmasa)")

    def handle(self, *args, file=None, **opts):
        self.stdout.write("Yuklanmoqda (butun O'zbekiston, 1-4 daqiqa)...")
        added, updated = import_osm(file)
        self.stdout.write(self.style.SUCCESS(f"✅ Shoxobchalar: {added} ta yangi, {updated} ta yangilandi"))
