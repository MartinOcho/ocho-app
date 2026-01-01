export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");

    if (authHeader !== `Bearer ${process.env.VERIFY_SECRET}`) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization header" }),
        { status: 401 },
      );
    }


    return new Response(null, { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
}
