import os
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, String, Text, DateTime,
    Float, Integer, ForeignKey, Boolean,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./db/fintelligence.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    reports = relationship("Report", back_populates="owner", cascade="all, delete-orphan")


class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    file_type = Column(String)
    status = Column(String, default="processing")   # processing | completed | failed
    progress = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)

    # Analysis results stored as JSON text
    metrics_json = Column(Text, nullable=True)
    anomalies_json = Column(Text, nullable=True)
    charts_json = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    column_mapping_json = Column(Text, nullable=True)

    row_count = Column(Integer, nullable=True)
    col_count = Column(Integer, nullable=True)
    anomaly_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    owner = relationship("User", back_populates="reports")


def create_tables():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
