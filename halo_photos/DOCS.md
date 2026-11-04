# Halo Photo Converter

Reads HEIC/HEIF originals from /homeassistant/dashboard_photos and writes separate JPEG display copies there. It does not modify or upload to Drive. It checks once per minute and refreshes the existing family album after conversion. Enable the existing Rclone copy job every five minutes and disable its run_once option. The first batch can take longer. Originals and previous JPEGs are never deleted automatically. This app needs access to the Home Assistant configuration volume to reach that existing folder; its code only uses dashboard_photos.
