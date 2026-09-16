# Local upstream backend integration

Source: https://github.com/jagravsinghjs/STILL-care/tree/main
Inspected revision: b9d7346f7027df4c72f22ad06583538e2915c9d4.
The source was cloned separately; no remote writes were performed.

The latest local `frontend/` remains the application UI. Upstream frontend,
src and public folders were not imported. Upstream intelligence_model and
case-profile Python sources already match the local versions. The five
upstream chatbot stage scripts were copied to the existing numbered root
folders; their contents already match. The backend worker now resolves
these actual locations instead of the obsolete chatbot/01...05 paths.

## Connections

- Frontend uses http://127.0.0.1:8000 through its existing authenticated API client.
- STILL Assistant uses /api/assistant/chat and saves completed sessions through /api/checkins.
- Integrated check-ins call the downloaded chatbot stages and intelligence bridge.
- Patient history/report downloads use private patient endpoints.
- Counsellor views/downloads use authorized summaries; the upstream unauthenticated
  sub-application is not exposed directly.
- Stage 06 case-profile extraction is present but has no profile-edit integration.
- Browser microphone input produces text. WAV processing exists at /api/checkins/audio,
  but the current frontend does not upload recorded audio to this endpoint.

## Real AI prerequisites

Run from the project root in a terminal with Microsoft C++ build tools available:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-integrated.txt
.\.venv\Scripts\python.exe -m pip install --no-deps ./intelligence_model --config-settings=cmake.define.STILL_BUILD_ALERTD=OFF --config-settings=cmake.define.STILL_BUILD_CPP_TESTS=OFF
```

The no-deps option preserves the authenticated backend's FastAPI/Pydantic versions.
Install/start Ollama and obtain its qwen2.5:7b-instruct model. Hugging Face text,
speech-emotion and Whisper weights are additionally loaded on first use.
Only after these prerequisites work, set BACKEND_MODE=integrated in backend/.env
and restart the backend. No seed/reset operation is needed.

Verification on 2026-09-16: integrated Python requirements installed successfully.
CMake 4.4.3 and Ollama 0.34.1 are installed; Ollama's local API responds.
The qwen2.5:7b-instruct pull was started and is still downloading.
Visual Studio Community 2026 is registered, but vswhere reports isComplete=false,
isLaunchable=false and canceled=1. Its VsDevCmd.bat was executed; cl.exe still
could not be found. The intelligence build fails with missing NMake and unset
C/C++ compilers. BACKEND_MODE remains mock pending successful real dependencies.
The frontend was started at http://127.0.0.1:5174; login page and actual-origin
CORS pass. Both existing demo logins and dashboard API reads pass. Supervisor
private-history access returns 403, and summaries omit raw_reflection.
Frontend build, 7 frontend tests and 24 backend tests pass. Real inference and
integrated check-in processing remain unverified; no database reset was run.
