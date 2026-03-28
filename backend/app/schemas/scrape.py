from typing import List, Optional

from pydantic import AliasChoices, BaseModel, Field


class ScrapePageRequest(BaseModel):
    url: str = Field(..., min_length=4, max_length=2048)
    use_rendered_scrape: bool = Field(
        default=True,
        validation_alias=AliasChoices("use_rendered_scrape", "use_firecrawl"),
        description="When True: Zyte API (browser HTML) when a key is available, else direct HTTP. "
        "(use_firecrawl is a legacy JSON alias for this flag.)",
    )


class ScrapedImageOut(BaseModel):
    url: str
    alt: Optional[str] = None
    source: str


class ScrapePageResponse(BaseModel):
    page_url: str
    final_url: str
    images: List[ScrapedImageOut]
    truncated: bool = False
    scrape_image_cap: int = Field(
        ...,
        description="Maximum image URLs the server will return for one scan (list may be truncated).",
    )


class ImportUrlsRequest(BaseModel):
    urls: List[str] = Field(..., min_length=1)


class EmbedCheckRequest(BaseModel):
    url: str = Field(..., min_length=4, max_length=2048)


class EmbedCheckResponse(BaseModel):
    final_url: str
    embed_allowed: bool
    detail: str = ""
