from .checkin import SupervisorSessionSummary, PatientCheckInResponse
# Separate, explicit response types; no ORM model serialization.
SupervisorReport = SupervisorSessionSummary
PatientReport = PatientCheckInResponse
