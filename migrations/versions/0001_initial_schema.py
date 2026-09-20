"""Initial schema: transactions, predictions, model versions, reviews, audit.

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-20

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "model_versions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("version", sa.String(length=128), nullable=False),
        sa.Column("model_name", sa.String(length=64), nullable=False),
        sa.Column("trained_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("artifact_sha256", sa.String(length=64), nullable=True),
        sa.Column("recommended_threshold", sa.Float(), nullable=True),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    # Matches the model's `unique=True, index=True`, which SQLAlchemy renders as
    # a single unique index rather than a constraint plus an index.
    op.create_index(
        "ix_model_versions_version", "model_versions", ["version"], unique=True
    )

    op.create_table(
        "transactions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("source", sa.String(length=16), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("time_offset", sa.Float(), nullable=False),
        sa.Column("features", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_transactions_created_at", "transactions", ["created_at"], unique=False
    )

    op.create_table(
        "predictions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("transaction_id", sa.String(length=36), nullable=False),
        sa.Column("model_version_id", sa.Integer(), nullable=True),
        sa.Column("probability", sa.Float(), nullable=False),
        sa.Column("is_flagged", sa.Boolean(), nullable=False),
        sa.Column("threshold", sa.Float(), nullable=False),
        sa.Column("latency_ms", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["transaction_id"], ["transactions.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["model_version_id"], ["model_versions.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_predictions_transaction_id", "predictions", ["transaction_id"], unique=False
    )
    op.create_index(
        "ix_predictions_model_version_id",
        "predictions",
        ["model_version_id"],
        unique=False,
    )
    op.create_index(
        "ix_predictions_is_flagged", "predictions", ["is_flagged"], unique=False
    )
    op.create_index(
        "ix_predictions_created_at", "predictions", ["created_at"], unique=False
    )

    op.create_table(
        "review_decisions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("transaction_id", sa.String(length=36), nullable=False),
        sa.Column("decision", sa.String(length=16), nullable=False),
        sa.Column("decided_by", sa.String(length=128), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["transaction_id"], ["transactions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_review_decisions_transaction_id",
        "review_decisions",
        ["transaction_id"],
        unique=False,
    )
    op.create_index(
        "ix_review_decisions_created_at",
        "review_decisions",
        ["created_at"],
        unique=False,
    )

    op.create_table(
        "audit_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("actor", sa.String(length=128), nullable=False),
        sa.Column("subject_type", sa.String(length=64), nullable=False),
        sa.Column("subject_id", sa.String(length=64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_audit_events_event_type", "audit_events", ["event_type"], unique=False
    )
    op.create_index(
        "ix_audit_events_subject_id", "audit_events", ["subject_id"], unique=False
    )
    op.create_index(
        "ix_audit_events_created_at", "audit_events", ["created_at"], unique=False
    )


def downgrade() -> None:
    op.drop_table("audit_events")
    op.drop_table("review_decisions")
    op.drop_table("predictions")
    op.drop_table("transactions")
    op.drop_table("model_versions")
