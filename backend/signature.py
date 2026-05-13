import os
import re


class Signature:
    def build(self, data: dict) -> dict:
        return {
            "profilePhotoSrc": data["profile_photo_url"],
            "firstName": data["first_name"],
            "surname": data["surname"],
            "jobTitle": data["job_title"],
            "company": "Spatialedge",
            "phone": self._format_phone(data["phone"]),
            "emailAddress": data["email"],
            "companyWebsiteLink": "spatialedge.ai",
            "imageBase": os.getenv("SITE_URL", "http://localhost:8080"),
        }

    def _format_phone(self, raw: str) -> str:
        digits = re.sub(r"\D", "", raw)
        # +27 XX XXX XXXX (11 digits with country code)
        if digits.startswith("27") and len(digits) == 11:
            return f"+{digits[:2]} {digits[2:4]} {digits[4:7]} {digits[7:]}"
        # 0XX XXX XXXX (10 digits, SA local format)
        if digits.startswith("0") and len(digits) == 10:
            return f"+27 {digits[1:3]} {digits[3:6]} {digits[6:]}"
        # XX XXX XXXX (9 digits, no leading 0 or country code)
        if len(digits) == 9:
            return f"+27 {digits[:2]} {digits[2:5]} {digits[5:]}"
        return raw
