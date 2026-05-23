from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class RoadmapNote(SQLModel):
    note_title: str
    note_description: str
    timestamp: str


class RoadmapTask(SQLModel):
    task_name: str
    task_description: str
    task_attachments: list[str] = Field(default_factory=list)
    is_completed: bool = False


class RoadmapDayPlanner(SQLModel):
    day_no: int
    tasks: list[RoadmapTask] = Field(default_factory=list)
    is_completed: bool = False


class Roadmap(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    name: str = ""
    description: str = ""
    attachments: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False),
    )
    planner: list[dict] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False),
    )
    notes: list[dict] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False),
    )
    author_id: Optional[int] = Field(default=None, index=True)

    # Keep generation metadata currently used by upload route.
    user_goal: str = ""
    time_query: str = ""
    roadmap_content: str = ""
    processed_types: str = ""
    documents_count: int = 0

    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
