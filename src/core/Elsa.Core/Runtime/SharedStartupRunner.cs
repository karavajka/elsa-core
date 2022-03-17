using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Elsa.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Elsa.Runtime
{
    public class SharedStartupRunner : ISharedStartupRunner
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<SharedStartupRunner> _logger;
        private readonly ICollection<Type> _startupTaskTypes;

        public SharedStartupRunner(IEnumerable<ISharedStartupTask> startupTasks, IServiceProvider serviceProvider, ILogger<SharedStartupRunner> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            _startupTaskTypes = startupTasks.OrderBy(x => x.Order).Select(x => x.GetType()).ToList();
        }

        public async Task StartupAsync(CancellationToken cancellationToken = default)
        {
            // TODO: Register Startup Types the same way Activity Types are registered.
            foreach (var startupTaskType in _startupTaskTypes)
            {
                var startupTask = (ISharedStartupTask)_serviceProvider.GetRequiredService(startupTaskType);
                _logger.LogInformation("Running shared startup task {StartupTaskName}", startupTaskType.Name);
                await startupTask.ExecuteAsync(cancellationToken);
            }
        }
    }
}