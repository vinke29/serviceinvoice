import { useState, useEffect } from 'react';

function OnboardingConfig({ onSave, initialConfig }) {
  console.log("OnboardingConfig: initialConfig =", initialConfig);

  // Step state
  const [step, setStep] = useState(0);

  // Config state
  const [netDays, setNetDays] = useState(initialConfig?.netDays ?? 0);
  console.log("OnboardingConfig: Initial netDays set to =", netDays, "from", initialConfig?.netDays);
  const [reminderEnabled, setReminderEnabled] = useState(
    initialConfig?.reminderEnabled ?? (initialConfig?.netDays === 0 || initialConfig?.netDays === undefined ? false : true)
  );
  const [reminderDaysBefore, setReminderDaysBefore] = useState(initialConfig?.reminderDaysBefore || 1);
  const [reminderTemplate, setReminderTemplate] = useState(initialConfig?.templates?.initial || 'Dear {clientName}, this is a friendly reminder that your invoice #{invoiceNumber} for ${amount} is due on {dueDate}. Please ensure timely payment to avoid any late fees.');
  const [followupInterval, setFollowupInterval] = useState(initialConfig?.followupInterval || 3);
  const [maxFollowups, setMaxFollowups] = useState(initialConfig?.maxFollowups || 3);
  const [followupTemplate, setFollowupTemplate] = useState(initialConfig?.templates?.followUp || 'Dear {clientName}, your invoice #{invoiceNumber} for ${amount} is now {daysOverdue} days overdue. Please process the payment as soon as possible.');
  const [escalationDays, setEscalationDays] = useState(initialConfig?.escalationDays || 14);
  const [escalationTemplate, setEscalationTemplate] = useState(initialConfig?.templates?.escalation || 'Dear {clientName}, your invoice #{invoiceNumber} for ${amount} is now {daysOverdue} days overdue. This is our final notice before we take further action. Please contact us immediately to resolve this matter.');

  // Calculate total follow-up days
  const totalFollowupDays = followupInterval * maxFollowups
  // Ensure escalationDays is always after follow-ups
  const minEscalationDays = totalFollowupDays + 1
  // Auto-correct escalationDays if too low
  if (escalationDays < minEscalationDays) setEscalationDays(minEscalationDays)

  // Handle netDays changes and automatically disable reminders when set to 1
  useEffect(() => {
    if (netDays === 1 && reminderEnabled) {
      setReminderEnabled(false);
    }
    // Always set reminderDaysBefore to the max valid value on netDays change
    if (netDays <= 1) {
      setReminderDaysBefore(1);
    } else {
      setReminderDaysBefore(Math.max(1, netDays - 1));
    }
  }, [netDays, reminderEnabled]);

  // Step content
  const steps = [
    {
      title: 'When is the invoice due?',
      content: (
        <div className="space-y-4">
          <div className="text-lg font-medium">How many days after sending the invoice should your customer pay?</div>
          <div className="flex items-center gap-2">
            <span>Net</span>
            <input
              type="number"
              min={0}
              max={90}
              value={netDays}
              onChange={e => setNetDays(Number(e.target.value))}
              className="w-20 px-2 py-1 border border-secondary-200 rounded-lg text-center"
            />
            <span>days</span>
            <div className="flex gap-2 ml-4">
              {[7, 15, 30, 60].map(val => (
                <button
                  key={val}
                  onClick={() => setNetDays(val)}
                  className={`px-3 py-1 rounded-lg border ${netDays === val ? 'bg-primary-600 text-white' : 'bg-secondary-100 text-secondary-700'} hover:bg-primary-100`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
          <div className="text-sm text-secondary-500">
            {netDays === 0
              ? 'This means the invoice is due immediately upon receipt.'
              : `This means the customer has ${netDays} days to pay after receiving the invoice.`}
          </div>
        </div>
      ),
    },
    {
      title: 'Initial Reminder (before due date)',
      content: (
        <div className="space-y-4">
          {netDays <= 0 ? (
            <div className="text-xs text-orange-600 mt-1">
              Reminders before the due date are not available for invoices due immediately.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={e => setReminderEnabled(e.target.checked)}
                  id="reminder-toggle"
                  className="w-5 h-5 accent-primary-600"
                />
                <label htmlFor="reminder-toggle" className="text-lg font-medium">Remind my customer before the invoice is due</label>
              </div>
              {reminderEnabled && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span>Remind</span>
                    <input
                      type="number"
                      min={1}
                      max={netDays - 1}
                      value={reminderDaysBefore > netDays - 1 ? netDays - 1 : reminderDaysBefore}
                      onChange={e => {
                        let val = Number(e.target.value);
                        if (val >= netDays) val = netDays - 1;
                        if (val < 1) val = 1;
                        setReminderDaysBefore(val);
                      }}
                      className="w-16 px-2 py-1 border border-secondary-200 rounded-lg text-center"
                    />
                    <span>days before it's due</span>
                    <div className="flex gap-2 ml-4">
                      {[1, 3, 5, 7].map(val => (
                        <button
                          key={val}
                          onClick={() => setReminderDaysBefore(val > netDays - 1 ? netDays - 1 : val)}
                          className={`px-3 py-1 rounded-lg border ${reminderDaysBefore === val ? 'bg-primary-600 text-white' : 'bg-secondary-100 text-secondary-700'} hover:bg-primary-100`}
                          disabled={val > netDays - 1}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                  {reminderDaysBefore >= netDays - 1 && (
                    <div className="text-xs text-orange-600 mt-4 mb-4">
                      You can only send a reminder up to {netDays - 1} days before the due date, since the invoice is due in {netDays} days.
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-1 mt-4">Initial Reminder Message</label>
                    <textarea
                      value={reminderTemplate}
                      onChange={e => setReminderTemplate(e.target.value)}
                      className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      rows={3}
                      placeholder="Dear {clientName}, this is a friendly reminder that your invoice #{invoiceNumber} for ${amount} is due on {dueDate}. Please ensure timely payment to avoid any late fees."
                    />
                    <div className="text-xs text-secondary-500 mt-1">Available variables: {'{clientName}, {amount}, {dueDate}, {invoiceNumber}'}</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ),
    },
    {
      title: 'Follow-up Reminders (after due date)',
      content: (
        <div className="space-y-4">
          <div className="text-lg font-medium">If they don't pay, how often should we remind them?</div>
          <div className="flex items-center gap-2">
            <span>Remind every</span>
            <input
              type="number"
              min={1}
              max={30}
              value={followupInterval}
              onChange={e => setFollowupInterval(Number(e.target.value))}
              className="w-16 px-2 py-1 border border-secondary-200 rounded-lg text-center"
            />
            <span>days, up to</span>
            <input
              type="number"
              min={1}
              max={10}
              value={maxFollowups}
              onChange={e => setMaxFollowups(Number(e.target.value))}
              className="w-16 px-2 py-1 border border-secondary-200 rounded-lg text-center"
            />
            <span>times</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1 mt-4">Follow-up Reminder Message</label>
            <textarea
              value={followupTemplate}
              onChange={e => setFollowupTemplate(e.target.value)}
              className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows={3}
              placeholder="Dear {clientName}, your invoice #{invoiceNumber} for ${amount} is now {daysOverdue} days overdue. Please process the payment as soon as possible."
            />
            <div className="text-xs text-secondary-500 mt-1">Available variables: {'{clientName}, {amount}, {dueDate}, {invoiceNumber}, {daysOverdue}'}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Escalation threshold',
      content: (
        <div className="space-y-4">
          <div className="text-lg font-medium">If your customer still hasn't paid, when should we let you know or take further action?</div>
          <div className="text-sm text-secondary-500 mb-2">
            <b>Note:</b> Escalation can only happen after all follow-up reminders are sent.<br />
            With your current settings, follow-ups will be sent every <b>{followupInterval} days</b>, up to <b>{maxFollowups} times</b> (until <b>{totalFollowupDays} days overdue</b>).<br />
            Escalation must be at least <b>{minEscalationDays} days overdue</b>.
          </div>
          <div className="flex items-center gap-2">
            <span>Escalate if unpaid after</span>
            <input
              type="number"
              min={minEscalationDays}
              max={60}
              value={escalationDays}
              onChange={e => setEscalationDays(Math.max(Number(e.target.value), minEscalationDays))}
              className="w-16 px-2 py-1 border border-secondary-200 rounded-lg text-center"
            />
            <span>days overdue</span>
            <div className="flex gap-2 ml-4">
              {[3, 7, 14, 30].map(val => (
                <button
                  key={val}
                  onClick={() => setEscalationDays(Math.max(val, minEscalationDays))}
                  className={`px-3 py-1 rounded-lg border ${escalationDays === val ? 'bg-primary-600 text-white' : 'bg-secondary-100 text-secondary-700'} hover:bg-primary-100`}
                  disabled={val < minEscalationDays}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
          {escalationDays < minEscalationDays && (
            <div className="text-xs text-red-600 mt-1">Escalation must be after all follow-up reminders. Adjusted to {minEscalationDays} days.</div>
          )}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1 mt-4">Escalation Message</label>
            <textarea
              value={escalationTemplate}
              onChange={e => setEscalationTemplate(e.target.value)}
              className="w-full px-4 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows={3}
              placeholder="Dear {clientName}, your invoice #{invoiceNumber} for ${amount} is now {daysOverdue} days overdue. This is our final notice before we take further action. Please contact us immediately to resolve this matter."
            />
            <div className="text-xs text-secondary-500 mt-1">Available variables: {'{clientName}, {amount}, {dueDate}, {invoiceNumber}, {daysOverdue}'}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Summary',
      content: (
        <div className="space-y-4">
          <div className="text-lg font-medium">Here's what will happen:</div>
          <div className="bg-secondary-50 rounded-xl p-4 text-secondary-800">
            <ul className="list-disc pl-6 space-y-2">
              <li>Invoices are sent automatically based on each client's frequency.</li>
              <li>Your customer will have <b>{netDays === 0 ? 'Due immediately' : `${netDays} days`}</b> to pay after receiving the invoice.</li>
              {reminderEnabled && netDays > 1 ? (
                <li>We'll remind them <b>{reminderDaysBefore} days before</b> it's due.</li>
              ) : (
                <li>
                  <span className="font-medium">Initial Reminder:</span>{' '}
                  {netDays <= 1 ? (
                    <span className="text-orange-600">Not available for 1-day invoice terms.</span>
                  ) : (
                    <span>Disabled</span>
                  )}
                </li>
              )}
              <li>If they don't pay, we'll remind them every <b>{followupInterval} days</b>, up to <b>{maxFollowups} times</b> (until <b>{totalFollowupDays} days overdue</b>).</li>
              <li><b>Escalation will only happen after all reminders are sent, on day {minEscalationDays} overdue or later.</b></li>
              <li>If they still haven't paid after <b>{escalationDays} days overdue</b>, we'll let you know or take further action.</li>
            </ul>
            <div className="mt-6">
              <div className="font-semibold text-secondary-700 mb-2">Message Templates:</div>
              <div className="mb-2">
                <span className="font-medium">Initial Reminder:</span>
                <div className="bg-white border border-secondary-100 rounded p-2 text-sm mt-1">{reminderTemplate}</div>
              </div>
              <div className="mb-2">
                <span className="font-medium">Follow-up Reminder:</span>
                <div className="bg-white border border-secondary-100 rounded p-2 text-sm mt-1">{followupTemplate}</div>
              </div>
              <div>
                <span className="font-medium">Escalation Message:</span>
                <div className="bg-white border border-secondary-100 rounded p-2 text-sm mt-1">{escalationTemplate}</div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-3xl w-full mx-auto bg-white rounded-2xl shadow-soft p-6 md:p-10 mt-8">
      <h2 className="text-2xl font-bold text-secondary-900 mb-6">Let's set up how you want to handle payments and reminders</h2>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          {steps.map((s, i) => (
            <div key={i} className={`w-8 h-2 rounded-full ${i <= step ? 'bg-primary-600' : 'bg-secondary-200'}`}></div>
          ))}
        </div>
        <div className="text-xl font-semibold text-primary-700 mb-2">{steps[step].title}</div>
        <div>{steps[step].content}</div>
      </div>
      <div className="flex justify-between items-center mt-8">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="px-4 py-2 rounded-lg bg-secondary-100 text-secondary-700 hover:bg-secondary-200 disabled:opacity-50"
        >
          Back
        </button>
        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep(Math.min(steps.length - 1, step + 1))}
            className="px-6 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
          >
            Next
          </button>
        ) : (
          <button
            onClick={() => {
              // Ensure reminderEnabled is false when netDays is 1
              const effectiveReminderEnabled = netDays <= 1 ? false : reminderEnabled;
              
              const configToSave = {
                netDays: parseInt(netDays, 10),
                reminderEnabled: effectiveReminderEnabled,
                reminderDaysBefore: parseInt(reminderDaysBefore, 10),
                followupInterval: parseInt(followupInterval, 10),
                maxFollowups: parseInt(maxFollowups, 10),
                escalationDays: parseInt(escalationDays, 10),
                templates: {
                  initial: reminderTemplate,
                  followUp: followupTemplate,
                  escalation: escalationTemplate
                }
              };
              
              console.log("OnboardingConfig: Saving configuration with netDays =", configToSave.netDays);
              console.log("OnboardingConfig: Full config =", configToSave);
              
              onSave && onSave(configToSave);
            }}
            className="px-6 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
          >
            Finish & Save
          </button>
        )}
      </div>
    </div>
  );
}

export default OnboardingConfig; 