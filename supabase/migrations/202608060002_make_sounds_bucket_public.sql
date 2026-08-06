-- Published catalog audio uses /object/public/sounds/ URLs.
update storage.buckets
set public = true
where id = 'sounds';
