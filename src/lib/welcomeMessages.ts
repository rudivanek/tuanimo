export function getPreferredGreetingName(profile: {
  first_name?: string | null;
  full_name?: string | null;
}): string | null {
  const firstName = profile.first_name?.trim();
  if (firstName) return firstName;

  const fullName = profile.full_name?.trim();
  if (fullName) {
    const firstToken = fullName.split(/\s+/)[0];
    if (firstToken) return firstToken;
  }

  return null;
}