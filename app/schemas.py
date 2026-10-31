from typing import Literal
from pydantic import BaseModel, Field


class Preferences(BaseModel):
    budget: float = Field(25, ge=0, le=1000)
    minutes: int = Field(240, ge=15, le=1440)
    group_size: int = Field(2, ge=1, le=30)
    group_type: Literal['any', 'solo', 'friends', 'family', 'couple'] = 'any'
    district: str = 'any'
    category: str = 'any'
    environment: Literal['any', 'indoor', 'outdoor', 'mixed'] = 'any'
    rain_friendly: bool = False
    accessible: bool = False
    mood: Literal['any', 'relaxed', 'curious', 'social', 'adventurous', 'romantic'] = 'any'


class SearchRequest(BaseModel):
    query: str = Field('', max_length=1200)
    preferences: Preferences = Field(default_factory=Preferences)
    limit: int = Field(12, ge=1, le=50)


class Turn(BaseModel):
    role: Literal['user', 'assistant']
    content: str = Field(max_length=6000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1200)
    history: list[Turn] = Field(default_factory=list, max_length=16)
    preferences: Preferences = Field(default_factory=Preferences)


class ItineraryRequest(BaseModel):
    attraction_ids: list[str] = Field(min_length=1, max_length=3)
    budget: float = Field(25, ge=0, le=1000)
    minutes: int = Field(240, ge=15, le=1440)
