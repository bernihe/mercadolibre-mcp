const express = require("express");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const axios = require("axios");

const app = express();
const transport = new SSEServerTransport("/messages", "/sse");
const mcpServer = new McpServer({
  name: "MercadoLibre-Gemini",
  version: "1.0.0",
});

// Helper to get Access Token
async function getAccessToken() {
  try {
    const response = await axios.post("https://api.mercadolibre.com/oauth/token", {
      grant_type: "client_credentials",
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET
    }, {
      headers: { "Content-Type": "application/json" }
    });
    return response.data.access_token;
  } catch (error) {
    console.error("Auth Error:", error.response ? error.response.data : error.message);
    throw new Error("Could not authenticate with Mercado Libre.");
  }
}

// Define the Search Tool
mcpServer.tool(
  "search_products",
  {
    query: { type: "string", description: "Product to search for (e.g., 'iPhone 15')" },
    limit: { type: "number", description: "Number of results (default 5)" }
  },
  async ({ query, limit = 5 }) => {
    try {
      const token = await getAccessToken();
      
      const response = await axios.get(`https://mercadolibre.com`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { q: query, limit: limit }
      });

      const products = response.data.results.map(item => ({
        title: item.title,
        price: item.price,
        currency: item.currency_id,
        link: item.permalink,
        condition: item.condition
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(products, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: "Error searching Mercado Libre: " + error.message }]
      };
    }
  }
);

// Connect Express to MCP
app.get("/sse", async (req, res) => {
  console.log("Gemini connected via SSE");
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res);
});

app.post("/messages", async (req, res) => {
  await transport.handlePostMessage(req, res, req.body);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
