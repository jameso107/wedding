import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { planningServer } from "@/lib/planning/mcp";
import { isPerson } from "@/lib/planning/session";

// Remote MCP endpoint: planning.oosterhouse.wedding/mcp/hannah or /mcp/james.
// Stateless: each request gets a fresh server and transport.
async function handle(request: Request, { params }: RouteContext<"/planning/mcp/[person]">) {
  const { person } = await params;
  if (!isPerson(person)) return new Response("Not found", { status: 404 });

  const server = planningServer(person);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export { handle as GET, handle as POST, handle as DELETE };
