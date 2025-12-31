using System;
using System;
using System.Linq;
using System.Collections.Generic;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

public class CPHInline
{
	public bool Execute()
	{
		var rawInput = args.ContainsKey("rawInput") ? args["rawInput"].ToString() : string.Empty;
		if (string.IsNullOrWhiteSpace(rawInput))
		{
			CPH.LogWarn("Geen rawInput ontvangen.");
			return false;
		}

		var stored = CPH.GetGlobalVar<string>("puzzelAnswers", true) ?? string.Empty;
		var answers = stored
			.Split(new[] { "||" }, StringSplitOptions.RemoveEmptyEntries)
			.Select(a => a.Trim())
			.Where(a => a.Length > 0)
			.ToList();

		if (answers.Count == 0)
		{
			CPH.LogWarn("Geen opgeslagen puzzelantwoorden gevonden.");
			return false;
		}

		var match = FindMatch(rawInput, answers);
		if (match == null)
		{
			CPH.LogInfo($"Geen match voor '{rawInput}'.");
			return true;
		}

		// Verwijder gevonden antwoord en bewaar resterende
		answers.Remove(match);
		CPH.SetGlobalVar("puzzelAnswers", string.Join("||", answers), true);

		// Bouw payload richting overlay
		var payload = $"{{\"name\":\"PuzzelAnswer\",\"arguments\":{{\"answer\":\"{EscapeJson(match)}\",\"remaining\":{SerializeArray(answers)} }} }}";

		// Stuur websocket naar overlay (luistert op ws://localhost:8080)
		// Pas de URL aan indien je een andere host/poort gebruikt
		SendWebsocketMessage("ws://localhost:8080", payload).GetAwaiter().GetResult();

		CPH.LogInfo($"Antwoord goed: '{match}'. Resterend: {answers.Count}");
		return true;
	}

	private string Normalize(string s)
	{
		return (s ?? string.Empty).Trim().ToLowerInvariant();
	}

	private string FindMatch(string rawInput, List<string> answers)
	{
		var normInput = Normalize(rawInput);

		foreach (var ans in answers)
		{
			var normAns = Normalize(ans);

			// Exact match
			if (normInput == normAns)
				return ans;

			// Kleine typefout toestaan (afstand <= 1)
			if (Math.Abs(normInput.Length - normAns.Length) <= 1 && Levenshtein(normInput, normAns) <= 1)
				return ans;

			// Bevatten bij korte woorden
			if (normInput.Length >= 3 && (normAns.Contains(normInput) || normInput.Contains(normAns)))
				return ans;
		}

		return null;
	}

	private int Levenshtein(string s, string t)
	{
		var dp = new int[s.Length + 1, t.Length + 1];
		for (int i = 0; i <= s.Length; i++) dp[i, 0] = i;
		for (int j = 0; j <= t.Length; j++) dp[0, j] = j;
		for (int i = 1; i <= s.Length; i++)
		{
			for (int j = 1; j <= t.Length; j++)
			{
				int cost = s[i - 1] == t[j - 1] ? 0 : 1;
				dp[i, j] = Math.Min(
					Math.Min(dp[i - 1, j] + 1, dp[i, j - 1] + 1),
					dp[i - 1, j - 1] + cost);
			}
		}
		return dp[s.Length, t.Length];
	}

	private string EscapeJson(string s) => (s ?? string.Empty).Replace("\\", "\\\\").Replace("\"", "\\\"");

	private string SerializeArray(List<string> values)
	{
		return "[" + string.Join(",", values.Select(v => $"\"{EscapeJson(v)}\"")) + "]";
	}

	private async Task SendWebsocketMessage(string url, string payload)
	{
		using (var ws = new ClientWebSocket())
		{
			await ws.ConnectAsync(new Uri(url), CancellationToken.None);
			var buffer = Encoding.UTF8.GetBytes(payload);
			await ws.SendAsync(buffer, WebSocketMessageType.Text, true, CancellationToken.None);
			await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "done", CancellationToken.None);
		}
	}
}