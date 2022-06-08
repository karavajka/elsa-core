using Elsa.Workflows.Core.Activities;
using Elsa.Workflows.Core.Services;

namespace Elsa.IntegrationTests.Activities;

public class FinishSequentialWorkflow : WorkflowBase
{
    protected override void Build(IWorkflowDefinitionBuilder workflow)
    {
        workflow.WithRoot(new Sequence
        {
            Activities =
            {
                new WriteLine("Line 1"),
                new Finish(),
                new WriteLine("Line 2")
            }
        });
    }
}