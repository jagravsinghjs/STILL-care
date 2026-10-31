import {beforeEach,describe,it,expect,vi} from 'vitest';
import {useApp} from '../src/store/useApp';
import {register} from '../src/api/auth';
const response=(data:unknown)=>new Response(JSON.stringify(data),{status:200});
beforeEach(()=>{vi.restoreAllMocks();useApp.getState().logout()});
describe('server-backed session',()=>{
 it('rejects the wrong login tab before loading private data',async()=>{
 const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(response({access_token:'test-token',user:{id:'meera',name:'Test Supervisor',role:'SUPERVISOR'}}));
 await expect(useApp.getState().login('meera','test-input','user')).rejects.toThrow('correct login tab');
 expect(fetcher).toHaveBeenCalledTimes(1);expect(useApp.getState().identity).toBeNull();
 });
 it('keeps raw reflections out of graph reports and clears data on logout',async()=>{
 const summary={id:'one',patient_id:'student',mode:'written',created_at:'2026-09-15T00:00:00Z',summary:'Continuity update',attention_state:'YELLOW',trend:'WORSENING',themes:[],processing_mode:'mock'};
 vi.spyOn(globalThis,'fetch').mockImplementation(async(url)=>{
 const path=String(url);
 if(path.endsWith('/sessions'))return response([{session_id:'one',start_time:summary.created_at,end_time:summary.created_at,turn_count:1,mean_score:.5,max_score:.5,min_score:.5,volatility:0,within_session_trend:0,computed_at:summary.created_at}]);
 if(path.endsWith('/status'))return response({tier:'yellow'});
 if(path.endsWith('/trend'))return response([{computed_at:summary.created_at,trend_label:'worsening',slope:.1,confidence:.8,window_sessions:1}]);
 return response([]);
 });
 useApp.setState({identity:{id:'student',name:'Test Student',role:'STUDENT'},role:'user'});
 await useApp.getState().refresh();expect(useApp.getState().reports[0].id).toBe('one');expect(useApp.getState().status).toBe('yellow');
 useApp.getState().logout();expect(useApp.getState().reports).toEqual([]);expect(useApp.getState().reflections).toEqual([]);
 });
 it('registers through the backend without a browser-only account',async()=>{
 const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(response({id:'new.student',role:'STUDENT'}));
 await register('Test Student','new.student','test-input');
 expect(String(fetcher.mock.calls[0][0])).toMatch(/\/api\/auth\/register$/);
 expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({name:'Test Student',user_id:'new.student',password:'test-input'});
 });
});
