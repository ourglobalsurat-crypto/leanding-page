import { QuestionnaireBuilder } from "@/components/questionnaire-builder";
import { getDraftQuestionnaire } from "@/lib/questionnaire";

export default async function QuestionnairePage() {
  const questionnaire = await getDraftQuestionnaire();

  return (
    <main className="admin-page">
      <div className="admin-page-heading">
        <div><span className="admin-page-kicker">FORM BUILDER</span><h1>Questionnaire</h1><p>Add, edit, hide and reorder every question without touching code.</p></div>
      </div>
      {questionnaire ? <QuestionnaireBuilder questionnaire={questionnaire} /> : <div className="admin-notice error">No draft questionnaire was found. Run the database setup command once.</div>}
    </main>
  );
}
