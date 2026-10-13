import logging
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings

logger = logging.getLogger("mediflow.integrations.n8n")


class N8nClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    def _headers(self) -> dict[str, str]:
        key = self.settings.n8n_api_key
        if not self.settings.n8n_base_url or key is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="The n8n integration is not configured.",
            )
        return {
            "Accept": "application/json",
            "Content-Type": "application/json",
            self.settings.n8n_auth_header: key.get_secret_value(),
        }

    async def post(self, path: str, payload: dict[str, Any]) -> Any:
        headers = self._headers()
        base_url = (self.settings.n8n_base_url or "").rstrip("/")
        endpoint = f"{base_url}/{path.lstrip('/')}"
        try:
            async with httpx.AsyncClient(timeout=self.settings.n8n_timeout_seconds) as client:
                response = await client.post(endpoint, json=payload, headers=headers)
        except httpx.TimeoutException:
            logger.warning("n8n request timed out")
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="The clinical workflow did not respond in time. No result was saved.",
            ) from None
        except httpx.RequestError:
            logger.warning("n8n request could not be completed")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The clinical workflow is currently unavailable. No result was saved.",
            ) from None

        if response.status_code in (401, 403):
            logger.warning("n8n rejected the configured service authentication")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The clinical workflow rejected service authentication. No result was saved.",
            )
        if response.status_code >= 500:
            logger.warning("n8n returned a server error: status=%s", response.status_code)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The clinical workflow failed. No result was saved.",
            )
        if not response.is_success:
            logger.warning("n8n rejected a request: status=%s", response.status_code)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The clinical workflow rejected the request. No result was saved.",
            )
        try:
            return response.json()
        except ValueError:
            logger.warning("n8n returned a non-JSON response")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The clinical workflow returned an invalid response. No result was saved.",
            ) from None


def get_n8n_client() -> N8nClient:
    return N8nClient()
