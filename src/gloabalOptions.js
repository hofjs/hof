
/* A file for global option 
*/
export const GLOBAL_OPTIONS = {};

//For Objserve

GLOBAL_OPTIONS.metaInfos = {
	meta_key_default: '__meta',
	ps_prefix_default: '#',
	root_key_default: '__root',
	path_key_default: '__path',
	objectify_key_default: '__obj',
	Event_key_default: 'Changed',
	EventType: class { static before = 'before'; static after = 'after' },
	root_disable_events_key: '__disableEvents',
	cancel_prop: 'canceled',
	cascade: 'cascade',
	use_instead: 'use_instead',
}
