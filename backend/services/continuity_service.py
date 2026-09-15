ORDER = {'GREEN':0,'YELLOW':1,'RED':2}
def compare(previous, current):
    if previous is None or previous==current: return 'NO_CLEAR_CHANGE'
    return 'WORSENING' if ORDER[current] > ORDER[previous] else 'IMPROVING'
