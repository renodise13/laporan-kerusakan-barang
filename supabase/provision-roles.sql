update public.profiles as profiles
set
  name = case users.email
    when 'siswapesat@lapor-sarpras.example' then 'Siswa/Siswi Pesat'
    when 'gurupesat@lapor-sarpras.example' then 'Guru Pesat'
    when 'admin01@lapor-sarpras.example' then 'Petugas Sarpras'
  end,
  role = case users.email
    when 'admin01@lapor-sarpras.example' then 'admin'
    else 'user'
  end
from auth.users as users
where profiles.id = users.id
  and users.email in (
    'siswapesat@lapor-sarpras.example',
    'gurupesat@lapor-sarpras.example',
    'admin01@lapor-sarpras.example'
  );
