// ─────────────────────────────────────────────────────────────────────────────
// Addy AI — HTTP response helpers
// ─────────────────────────────────────────────────────────────────────────────

const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
};

export function ok(data, extra = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...BASE_HEADERS, ...extra },
  });
}

export function created(data) {
  return new Response(JSON.stringify(data), {
    status: 201,
    headers: BASE_HEADERS,
  });
}

export function noContent() {
  return new Response(null, { status: 204 });
}

export function badRequest(message = 'Bad request') {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: BASE_HEADERS,
  });
}

export function unauthorized(message = 'Unauthorized') {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: BASE_HEADERS,
  });
}

export function forbidden(message = 'Forbidden') {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: BASE_HEADERS,
  });
}

export function notFound(message = 'Not found') {
  return new Response(JSON.stringify({ error: message }), {
    status: 404,
    headers: BASE_HEADERS,
  });
}

export function serverError(message = 'Internal server error') {
  return new Response(JSON.stringify({ error: message }), {
    status: 500,
    headers: BASE_HEADERS,
  });
}

// Parse JSON body safely
export async function parseBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Require admin role
export function requireAdmin(user) {
  if (!user || user.role !== 'admin') {
    return forbidden('Admin access required');
  }
  return null;
}
