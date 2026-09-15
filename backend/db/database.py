from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool
from pathlib import Path

class Base(DeclarativeBase):
    pass

def make_engine(url):
    if url.startswith('sqlite:///') and ':memory:' not in url:
        Path(url.removeprefix('sqlite:///')).parent.mkdir(parents=True, exist_ok=True)
    args = {'connect_args': {'check_same_thread': False, 'timeout': 30}}
    if ':memory:' in url:
        args['poolclass'] = StaticPool
    engine = create_engine(url, **args)
    @event.listens_for(engine, 'connect')
    def setup(conn, _):
        conn.execute('PRAGMA foreign_keys=ON')
    return engine
