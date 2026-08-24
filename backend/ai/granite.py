"""
IBM Granite service layer.

All AI calls go through this module — direct API calls using the
ibm-watsonx-ai SDK. No LangChain, no agent framework.

Environment variables needed:
  IBM_API_KEY       — IBM Cloud API key
  IBM_PROJECT_ID    — watsonx.ai project ID
  IBM_MODEL_ID      — e.g. ibm/granite-13b-chat-v2
  IBM_API_URL       — watsonx.ai endpoint (defaults to Dallas)
"""
import os
import json
from typing import Optional

# ibm-watsonx-ai is the IBM-supported SDK (pip install ibm-watsonx-ai)
try:
    from ibm_watsonx_ai import Credentials
    from ibm_watsonx_ai.foundation_models import ModelInference
    from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as Params
    IBM_SDK_AVAILABLE = True
except ImportError:
    IBM_SDK_AVAILABLE = False


IBM_API_KEY    = os.getenv("IBM_API_KEY", "")
IBM_PROJECT_ID = os.getenv("IBM_PROJECT_ID", "")
IBM_MODEL_ID   = os.getenv("IBM_MODEL_ID", "ibm/granite-13b-chat-v2")
IBM_API_URL    = os.getenv("IBM_API_URL", "https://us-south.ml.cloud.ibm.com")

_model: Optional[object] = None


def _get_model():
    """Lazy-initialise the Granite model once per process."""
    global _model
    if _model is not None:
        return _model
    if not IBM_SDK_AVAILABLE:
        raise RuntimeError(
            "ibm-watsonx-ai package not installed. "
            "Run: pip install ibm-watsonx-ai"
        )
    if not IBM_API_KEY or not IBM_PROJECT_ID:
        raise RuntimeError(
            "IBM_API_KEY and IBM_PROJECT_ID must be set in your .env file."
        )
    credentials = Credentials(
        url=IBM_API_URL,
        api_key=IBM_API_KEY,
    )
    _model = ModelInference(
        model_id=IBM_MODEL_ID,
        credentials=credentials,
        project_id=IBM_PROJECT_ID,
        params={
            Params.MAX_NEW_TOKENS: 1024,
            Params.TEMPERATURE:    0.7,
            Params.TOP_P:          0.9,
            Params.REPETITION_PENALTY: 1.1,
        },
    )
    return _model


def generate(prompt: str, max_tokens: int = 1024) -> str:
    """
    Send a prompt to Granite and return the generated text.
    Raises RuntimeError on SDK/config problems.
    """
    model = _get_model()
    response = model.generate_text(prompt=prompt)
    # ibm-watsonx-ai returns the text directly as a string
    return response.strip() if isinstance(response, str) else str(response).strip()


def is_available() -> bool:
    """Return True if IBM SDK is installed and credentials are configured."""
    return (
        IBM_SDK_AVAILABLE
        and bool(IBM_API_KEY)
        and bool(IBM_PROJECT_ID)
    )
