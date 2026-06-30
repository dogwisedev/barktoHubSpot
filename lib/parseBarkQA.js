// lib/parseBarkQA.js
// Ported from the Zap's "Code by Zapier" step: Bark sends a Q&A block as an
// HTML string (bark.display.html) — pairs of <h3>question</h3><p>answer</p>.

function parseBarkQA(htmlString) {
  if (!htmlString) return {};

  const questionPattern = /<h3>(.*?)<\/h3>/g;
  const answerPattern = /<p>(.*?)<\/p>/g;

  const questions = [...htmlString.matchAll(questionPattern)].map((m) => m[1]);
  const answers = [...htmlString.matchAll(answerPattern)].map((m) => m[1]);

  const result = {};
  for (let i = 0; i < questions.length; i++) {
    result[questions[i]] = answers[i];
  }
  return result;
}

// Maps the parsed Q&A object onto HubSpot deal property internal names.
// Question text must match exactly what Bark sends — confirm via a live
// payload if any of these stop mapping.
function mapQAToDealProperties(qa) {
  return {
    additional_details: qa["Additional Details:"] || "",
    can_your_dog_s__socialise_with_other_dogs_:
      qa["Can your dog(s) socialise with other dogs? "] || "",
    would_you_consider_online_or_remote_dog_training_:
      qa["Would you consider an online or remote service?"] || "",
    what_is_the_breed_of_the_dog_s__: qa["What is the breed(s) of the dog(s)?"] || "",
    what_type_of_dog_training_do_you_need_:
      qa["What type of dog training do you need?"] || "",
    which_type_s__of_training_would_you_consider_:
      qa["Which type(s) of training would you consider?"] ||
      qa["What type of dog training do you need?"] ||
      "",
    what_are_the_dog_s__age_s__:
      qa["What are the dog(s) age(s) (select all that apply)?"] || "",
    how_likely_are_you_to_make_a_hiring_decision_:
      qa["How likely are you to make a hiring decision?"] || "",
    how_many_dogs_need_training_: qa["How many dogs need training?"] || "",
  };
}

// Builds the note logged on every purchase. Header differs depending on
// whether this is a genuine resubmission (updating an existing deal) or a
// brand-new lead (new contact/deal) — only resubmissions should say
// "RESUBMISSION THROUGH BARK"; new leads get a plain "NEW LEAD VIA BARK" header.
function buildResubmissionNote({ category, location, barkId, qa, isResubmission = false }) {
  const lines = [];
  lines.push(isResubmission ? "🐾 RESUBMISSION THROUGH BARK" : "🐾 NEW LEAD VIA BARK");
  lines.push("─────────────────────────────────────");
  lines.push(`Service: ${category || "Unknown service"}`);
  lines.push(`Location: ${location || "Unknown location"}`);
  lines.push(`Bark ID: ${barkId || "N/A"}`);
  lines.push("");

  if (qa && Object.keys(qa).length > 0) {
    lines.push("--- New Answers on Bark ---");
    lines.push("");
    for (const [q, a] of Object.entries(qa)) {
      lines.push(q);
      lines.push(`  → ${a}`);
      lines.push("");
    }
  }

  lines.push("↳ Logged automatically by Bark Buster.");
  return lines.join("\n");
}

module.exports = { parseBarkQA, mapQAToDealProperties, buildResubmissionNote };
