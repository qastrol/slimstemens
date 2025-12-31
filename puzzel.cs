using System;
using System.Linq;
using System.Collections.Generic;

public class CPHInline
{
	public bool Execute()
	{
		// Verwacht invoer: args["answers"] als komma-gescheiden string, optioneel args["baseUrl"]
		var baseUrl = args.ContainsKey("baseUrl")
			? args["baseUrl"].ToString()
			: "http://localhost:3000/puzzel-standalone.html";

		var answersArg = args.ContainsKey("answers")
			? args["answers"].ToString()
			: string.Empty;

		var answers = answersArg
			.Split(new[] { ',', ';', '|' }, StringSplitOptions.RemoveEmptyEntries)
			.Select(a => a.Trim())
			.Where(a => a.Length > 0)
			.ToList();

		if (answers.Count == 0)
		{
			CPH.LogInfo("Geen antwoorden opgegeven voor de puzzel-URL.");
			return false;
		}

		var queryValue = string.Join(",", answers.Select(Uri.EscapeDataString));
		var url = $"{baseUrl}?antwoorden={queryValue}";

		// Sla URL en antwoorden op als globale variabelen (permanent)
		CPH.SetGlobalVar("puzzelUrl", url, true);
		CPH.SetGlobalVar("puzzelAnswers", string.Join("||", answers), true);

		CPH.LogInfo($"Puzzel URL opgeslagen: {url}");
		return true;
	}
}
