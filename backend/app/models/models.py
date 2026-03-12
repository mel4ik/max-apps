# backend/app/models/models.py
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime,
    ForeignKey, Text, JSON, BigInteger, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    """Пользователь MAX."""
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True)  # MAX user_id
    first_name = Column(String(100))
    last_name = Column(String(100))
    username = Column(String(100))
    language_code = Column(String(10))
    created_at = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cards = relationship("Card", back_populates="user", lazy="selectin")


class Card(Base):
    """Транспортная карта (ЕТК)."""
    __tablename__ = "cards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)

    # Из card_info
    card_pan = Column(String(19), nullable=False)       # PAN 19 цифр
    card_sn = Column(String(20))                        # серийный номер
    card_type = Column(String(20))                      # тип карты (код)
    card_img_uri = Column(String(500))
    region = Column(String(200))
    is_social_card = Column(Boolean, default=False)
    is_online_card = Column(Boolean, default=False)
    is_replenishable = Column(Boolean, default=False)
    is_money_replenishable = Column(Boolean, default=False)
    is_roaming_allowed = Column(Boolean, default=False)

    # Из ticket_rule
    ticket_description = Column(String(200))

    # Управление
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="cards")
    snapshots = relationship("CardSnapshot", back_populates="card",
                             order_by="CardSnapshot.fetched_at.desc()", lazy="noload")

    __table_args__ = (
        Index("ix_cards_user_pan", "user_id", "card_pan", unique=True),
    )


class CardSnapshot(Base):
    """Снимок состояния карты из Informator API. Для resilient fallback."""
    __tablename__ = "card_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    card_id = Column(UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"), nullable=False)

    # card_info
    is_in_stoplist = Column(Boolean, default=False)
    stop_list_status = Column(String(50))

    # transport_application.counter
    ticket_type = Column(Integer)
    counter_type = Column(Integer)
    counter_trips_value = Column(Integer)          # counter_trips.counter_value
    counter_money_value = Column(BigInteger)        # counter_money.card_money_value (копейки)
    counter_money_currency = Column(Integer)        # 643 = RUB
    relevance_date = Column(String(50))

    # transport_application dates
    ta_start_date = Column(String(20))
    ta_expiration_date = Column(String(20))

    # extra_services (весь объект целиком для гибкости)
    extra_services = Column(JSON)

    # discount_rules
    discount_rules = Column(JSON)
    current_discount_rule = Column(JSON)

    # ticket_rule
    ticket_rule = Column(JSON)

    # Полный сырой ответ
    raw_response = Column(JSON)

    fetched_at = Column(DateTime, default=datetime.utcnow)
    is_stale = Column(Boolean, default=False)

    card = relationship("Card", back_populates="snapshots")

    __table_args__ = (
        Index("ix_snapshots_card_fetched", "card_id", "fetched_at"),
    )


class Trip(Base):
    """Поездка (из GET /v2/cards/{pan}/trips)."""
    __tablename__ = "trips"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    card_id = Column(UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"), nullable=False)
    trip_id = Column(String(100))       # ID из API Короны
    trip_code = Column(String(100))     # tripCode
    trip_date = Column(DateTime)
    route_num = Column(String(50))
    route_name = Column(String(200))
    carrier_name = Column(String(200))
    sum_amount = Column(BigInteger)     # копейки
    is_cash = Column(Boolean, default=False)
    is_refunded = Column(Boolean, default=False)
    region_code = Column(String(10))
    region_name = Column(String(100))
    raw_data = Column(JSON)
    fetched_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_trips_card_date", "card_id", "trip_date"),
        Index("ix_trips_trip_id", "trip_id"),
    )


class Replenishment(Base):
    """Пополнение/покупка услуги (из GET /v2/cards/{pan}/replenishments)."""
    __tablename__ = "replenishments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    card_id = Column(UUID(as_uuid=True), ForeignKey("cards.id", ondelete="CASCADE"), nullable=False)
    repl_id = Column(String(100))
    repl_date = Column(DateTime)
    sum_amount = Column(BigInteger)     # копейки
    type_operation = Column(String(50)) # покупка, перенос, возврат
    description = Column(String(300))
    raw_data = Column(JSON)
    fetched_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_repls_card_date", "card_id", "repl_date"),
    )
