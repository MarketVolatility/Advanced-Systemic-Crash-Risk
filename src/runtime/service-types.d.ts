type AuthApi = import('@supabase/supabase-js').SupabaseClient['auth'];
type AuthUser = import('@supabase/supabase-js').User;
type Snapshot = Record<'entryHistory'|'fedWatchHistory'|'fundingHistory'|'fredHistory'|'analysisHistory',string|null>;
interface DashboardDatabase {
 public:{Tables:{user_app_data:{
 Row:{user_id:string;data:Snapshot;updated_at:string|null};
 Insert:{user_id:string;data:Snapshot;updated_at?:string|null};
 Update:{user_id?:string;data?:Snapshot;updated_at?:string|null};
 Relationships:[];
 }};Views:Record<never,never>;Functions:Record<never,never>};
}
interface Window {supabase?:{createClient:typeof import('@supabase/supabase-js').createClient}}
