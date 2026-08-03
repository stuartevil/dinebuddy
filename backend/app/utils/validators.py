"""
Validation utilities for restaurant data
"""
import re
from typing import Optional


def validate_business_hours_format(business_hours: Optional[dict]) -> Optional[dict]:
    """
    Validate business hours format.
    Expected format: {"day": "HH:MM-HH:MM"} (e.g., {"monday": "09:00-17:00"})
    
    Raises ValueError if format is invalid (for Pydantic validation)
    """
    if business_hours is None:
        return None
    
    if not isinstance(business_hours, dict):
        raise ValueError('business_hours must be a dictionary of day: time-range')
    
    time_pattern = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d$")
    
    for day, hours in business_hours.items():
        if not isinstance(hours, str) or not time_pattern.match(hours):
            raise ValueError(
                f'Invalid business hours for {day}: {hours}. '
                f'Expected format: "HH:MM-HH:MM" (e.g., "09:00-17:00")'
            )
    
    return business_hours

