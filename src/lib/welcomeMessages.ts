export function getPreferredGreetingName(profile: {
  preferred_name?: string | null;
  first_name?: string | null;
  full_name?: string | null;
}): string | null {
  const preferred = profile.preferred_name?.trim();
  if (preferred) return preferred;

  const firstName = profile.first_name?.trim();
  if (firstName) return firstName;

  const fullName = profile.full_name?.trim();
  if (fullName) {
    const firstToken = fullName.split(/\s+/)[0];
    if (firstToken) return firstToken;
  }

  return null;
}
