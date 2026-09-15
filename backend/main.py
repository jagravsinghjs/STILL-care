from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import sessionmaker
from backend.core.config import Settings, ROOT
from backend.db.database import Base, make_engine
from backend.api import auth, patients, checkins, reports, supervisor, messages, alerts, trends, assistant

def create_app(settings=None):
    settings=settings or Settings()
    engine=make_engine(settings.database_url)
    @asynccontextmanager
    async def lifespan(app):
        Base.metadata.create_all(engine)
        if settings.mode=='integrated':
            raw=engine.raw_connection()
            try:
                raw.executescript((ROOT/'intelligence_model/db/schema.sql').read_text())
                raw.commit()
            finally: raw.close()
        yield
        engine.dispose()
    app=FastAPI(title='STILL-care API',version='1.0.0',lifespan=lifespan,description='Private user check-ins and supervisor continuity. Attention states are not diagnoses.')
    app.state.settings=settings
    app.state.engine=engine
    app.state.sessions=sessionmaker(engine,expire_on_commit=False)
    app.add_middleware(CORSMiddleware,allow_origins=settings.origins,allow_credentials=False,allow_methods=['GET','POST','PATCH'],allow_headers=['Authorization','Content-Type'])
    @app.exception_handler(StarletteHTTPException)
    async def http_error(request, exc):
        body=exc.detail if isinstance(exc.detail,dict) else {'error':f'HTTP_{exc.status_code}','message':exc.detail}
        return JSONResponse(body,status_code=exc.status_code)
    @app.exception_handler(RequestValidationError)
    async def validation_error(request,exc):
        # Pydantic errors include input values by default. Never echo them.
        return JSONResponse({'error':'INVALID_REQUEST','message':'Please check the required fields and formats.'},status_code=422)
    @app.exception_handler(Exception)
    async def internal_error(request,exc):
        return JSONResponse({'error':'INTERNAL_ERROR','message':'Unable to complete the request right now.'},status_code=500)
    @app.middleware('http')
    async def private_response_headers(request,call_next):
        response=await call_next(request)
        response.headers['Cache-Control']='no-store'
        response.headers['X-Content-Type-Options']='nosniff'
        return response
    @app.get('/api/health',tags=['Health'])
    def health(): return {'status':'ok','mode':settings.mode}
    for module in (auth,patients,checkins,reports,supervisor,messages,alerts,trends,assistant): app.include_router(module.router)
    return app

app=create_app()
