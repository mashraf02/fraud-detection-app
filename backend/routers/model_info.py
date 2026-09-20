"""Model metadata endpoint.

The UI previously hardcoded performance claims. Serving the evaluated metrics
from the training artifact keeps anything shown to a user traceable to a real
measurement.
"""

from __future__ import annotations

from fastapi import APIRouter

from ..dependencies import ModelDep, ScoringConfigDep
from ..schemas import ModelInfoResponse

router = APIRouter(tags=["model"])


@router.get("/model", response_model=ModelInfoResponse, summary="Model version and metrics")
def model_info(
    model: ModelDep, config: ScoringConfigDep
) -> ModelInfoResponse:
    return ModelInfoResponse(
        version=model.version,
        model_name=model.model_name,
        trained_at=model.trained_at,
        effective_threshold=config.threshold,
        recommended_threshold=model.recommended_threshold,
        threshold_source=config.source,
        features=model.feature_order,
        metrics=model.metrics,
        artifact_sha256=model.artifact_sha256,
        dataset=model.metadata.get("dataset", {}),
        runtime=model.metadata.get("runtime", {}),
    )
