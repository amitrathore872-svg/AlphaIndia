from datetime import datetime
from pydantic import BaseModel


class SystemSettingResponse(BaseModel):
    id: int
    setting_key: str
    setting_value: str
    setting_type: str
    description: str | None = None
    updated_at: datetime

    class Config:
        from_attributes = True


class SystemSettingUpdate(BaseModel):
    setting_value: str