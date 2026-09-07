from pathlib import Path
import sys

# Allow running from backend/scripts
ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from app.db.database import SessionLocal
from app.models.system_setting import SystemSetting

DEFAULT_SETTINGS = [
    {
        "setting_key": "monitoring_enabled",
        "setting_value": "true",
        "setting_type": "boolean",
        "description": "Enable or disable live monitoring engine."
    },
    {
        "setting_key": "market_session_enabled",
        "setting_value": "true",
        "setting_type": "boolean",
        "description": "Monitor during NSE/BSE market hours."
    },
    {
        "setting_key": "post_market_enabled",
        "setting_value": "true",
        "setting_type": "boolean",
        "description": "Continue monitoring after market closes."
    },
    {
        "setting_key": "non_result_session_enabled",
        "setting_value": "false",
        "setting_type": "boolean",
        "description": "Run monitoring outside earnings season."
    },
    {
        "setting_key": "weekend_monitoring",
        "setting_value": "false",
        "setting_type": "boolean",
        "description": "Allow monitoring on Saturdays and Sundays."
    },
    {
        "setting_key": "holiday_monitoring",
        "setting_value": "false",
        "setting_type": "boolean",
        "description": "Allow monitoring on exchange holidays."
    },
    {
        "setting_key": "market_interval_minutes",
        "setting_value": "5",
        "setting_type": "integer",
        "description": "Polling interval during market hours."
    },
    {
        "setting_key": "post_market_interval_minutes",
        "setting_value": "15",
        "setting_type": "integer",
        "description": "Polling interval after market hours."
    },
    {
        "setting_key": "market_start_time",
        "setting_value": "09:15",
        "setting_type": "time",
        "description": "Market monitoring start time (IST)."
    },
    {
        "setting_key": "market_end_time",
        "setting_value": "15:30",
        "setting_type": "time",
        "description": "Market monitoring end time (IST)."
    },
    {
        "setting_key": "post_market_end_time",
        "setting_value": "22:30",
        "setting_type": "time",
        "description": "Stop post-market monitoring after this time."
    },
]


def seed_settings():
    db = SessionLocal()

    inserted = 0
    updated = 0

    try:
        for item in DEFAULT_SETTINGS:
            existing = (
                db.query(SystemSetting)
                .filter(SystemSetting.setting_key == item["setting_key"])
                .first()
            )

            if existing:
                existing.setting_value = item["setting_value"]
                existing.setting_type = item["setting_type"]
                existing.description = item["description"]
                updated += 1
            else:
                db.add(SystemSetting(**item))
                inserted += 1

        db.commit()

        print("\n====================================")
        print("ALPHA INDIA SYSTEM SETTINGS SEEDED")
        print("====================================")
        print(f"Inserted : {inserted}")
        print(f"Updated  : {updated}")
        print("====================================\n")

    finally:
        db.close()


if __name__ == "__main__":
    seed_settings()