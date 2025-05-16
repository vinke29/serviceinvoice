import { useState, useEffect } from 'react'
import OnboardingConfig from './OnboardingConfig'
import Drawer from './Drawer'
import { getAgentConfig, setAgentConfig } from '../firebaseData'
import { auth } from '../firebase'

function EditableRow({ label, value, type = 'text', onChange, options, textarea, help, min, max }) {
  return (
    <div className="flex flex-col mb-4">
      <div className="font-medium text-secondary-800 mb-1">{label}</div>
      {textarea ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          rows={3}
        />
      ) : (
        <input
          type={type}
          value={value}
          min={min}
          max={max}
          onChange={e => onChange(e.target.value)}
          className="px-3 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          style={{ minWidth: 80 }}
        />
      )}
      {help && <div className="text-xs text-secondary-500 mt-1">{help}</div>}
    </div>
  )
}

function ReminderConfig({ config, onUpdate }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-2">
            Initial Reminder (days before due date)
          </label>
          <input
            type="number"
            value={config.initialReminderDays}
            onChange={(e) => onUpdate({ ...config, initialReminderDays: parseInt(e.target.value) })}
            className="w-full px-4 py-2 rounded-lg border border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-2">
            Follow-up Interval (days)
          </label>
          <input
            type="number"
            value={config.followUpIntervalDays}
            onChange={(e) => onUpdate({ ...config, followUpIntervalDays: parseInt(e.target.value) })}
            className="w-full px-4 py-2 rounded-lg border border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            min="1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-2">
            Maximum Follow-ups
          </label>
          <input
            type="number"
            value={config.maxFollowUps}
            onChange={(e) => onUpdate({ ...config, maxFollowUps: parseInt(e.target.value) })}
            className="w-full px-4 py-2 rounded-lg border border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            min="1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-2">
            Escalation Threshold (days overdue)
          </label>
          <input
            type="number"
            value={config.escalationThresholdDays}
            onChange={(e) => onUpdate({ ...config, escalationThresholdDays: parseInt(e.target.value) })}
            className="w-full px-4 py-2 rounded-lg border border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            min="1"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-medium text-secondary-700">Communication Channels</h4>
        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={config.useEmail}
              onChange={(e) => onUpdate({ ...config, useEmail: e.target.checked })}
              className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-secondary-900">Email</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={config.useSMS}
              onChange={(e) => onUpdate({ ...config, useSMS: e.target.checked })}
              className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-secondary-900">SMS</span>
          </label>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-medium text-secondary-700">Message Templates</h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Initial Reminder
            </label>
            <textarea
              value={config.templates.initial}
              onChange={(e) => onUpdate({
                ...config,
                templates: { ...config.templates, initial: e.target.value }
              })}
              className="w-full px-4 py-2 rounded-lg border border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows="3"
              placeholder="Available variables: {clientName}, {amount}, {dueDate}, {invoiceNumber}"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Follow-up Reminder
            </label>
            <textarea
              value={config.templates.followUp}
              onChange={(e) => onUpdate({
                ...config,
                templates: { ...config.templates, followUp: e.target.value }
              })}
              className="w-full px-4 py-2 rounded-lg border border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows="3"
              placeholder="Available variables: {clientName}, {amount}, {dueDate}, {invoiceNumber}, {daysOverdue}"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Escalation Message
            </label>
            <textarea
              value={config.templates.escalation}
              onChange={(e) => onUpdate({
                ...config,
                templates: { ...config.templates, escalation: e.target.value }
              })}
              className="w-full px-4 py-2 rounded-lg border border-secondary-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows="3"
              placeholder="Available variables: {clientName}, {amount}, {dueDate}, {invoiceNumber}, {daysOverdue}"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function EditNetDays({ initialValue, onSave, onCancel }) {
  const [netDays, setNetDays] = useState(initialValue)
  const changed = netDays !== initialValue
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(netDays); }}>
      <EditableRow
        label="Net Days"
        value={netDays}
        type="number"
        min={0}
        max={90}
        onChange={setNetDays}
      />
      {netDays === 0 && (
        <div className="text-xs text-green-600 mt-2">
          Net 0: Invoice is due immediately upon receipt.
        </div>
      )}
      {netDays === 1 && (
        <div className="text-xs text-orange-600 mt-2">
          Note: With 1-day invoice terms, initial reminders before the due date will be disabled since there's no time to send them.
        </div>
      )}
      {changed && (
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" className="px-4 py-2 rounded-lg bg-secondary-100 text-secondary-700 hover:bg-secondary-200" onClick={onCancel}>Cancel</button>
          <button type="submit" className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700">Save</button>
        </div>
      )}
    </form>
  )
}

function EditReminder({ initialDays, initialTemplate, maxDays, onSave, onCancel }) {
  const [reminderDaysBefore, setReminderDaysBefore] = useState(initialDays)
  const [reminderTemplate, setReminderTemplate] = useState(initialTemplate)
  const changed = reminderDaysBefore !== initialDays || reminderTemplate !== initialTemplate
  if (maxDays <= 1) {
    return (
      <div className="text-xs text-orange-600 mt-1">
        Reminders before the due date are not available for invoices due in 1 day.
      </div>
    )
  }
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(reminderDaysBefore, reminderTemplate); }}>
      <EditableRow
        label="Days Before Due"
        value={reminderDaysBefore > maxDays - 1 ? maxDays - 1 : reminderDaysBefore}
        type="number"
        min={1}
        max={maxDays - 1}
        onChange={val => setReminderDaysBefore(val > maxDays - 1 ? maxDays - 1 : val)}
      />
      {reminderDaysBefore >= maxDays - 1 && (
        <div className="text-xs text-orange-600 mt-4 mb-4">
          You can only send a reminder up to {maxDays - 1} days before the due date, since the invoice is due in {maxDays} days.
        </div>
      )}
      <EditableRow
        label="Initial Reminder Message"
        value={reminderTemplate}
        textarea
        help="Available variables: {clientName}, {amount}, {dueDate}, {invoiceNumber}"
        onChange={setReminderTemplate}
      />
      {changed && (
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" className="px-4 py-2 rounded-lg bg-secondary-100 text-secondary-700 hover:bg-secondary-200" onClick={onCancel}>Cancel</button>
          <button type="submit" className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700">Save</button>
        </div>
      )}
    </form>
  )
}

function EditFollowup({ initialInterval, initialMax, initialTemplate, onSave, onCancel }) {
  const [followupInterval, setFollowupInterval] = useState(initialInterval)
  const [maxFollowups, setMaxFollowups] = useState(initialMax)
  const [followupTemplate, setFollowupTemplate] = useState(initialTemplate)
  const changed = followupInterval !== initialInterval || maxFollowups !== initialMax || followupTemplate !== initialTemplate
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(followupInterval, maxFollowups, followupTemplate); }}>
      <EditableRow
        label="Follow-up Interval (days)"
        value={followupInterval}
        type="number"
        min={1}
        max={30}
        onChange={setFollowupInterval}
      />
      <EditableRow
        label="Max Follow-ups"
        value={maxFollowups}
        type="number"
        min={1}
        max={10}
        onChange={setMaxFollowups}
      />
      <EditableRow
        label="Follow-up Reminder Message"
        value={followupTemplate}
        textarea
        help="Available variables: {clientName}, {amount}, {dueDate}, {invoiceNumber}, {daysOverdue}"
        onChange={setFollowupTemplate}
      />
      {changed && (
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" className="px-4 py-2 rounded-lg bg-secondary-100 text-secondary-700 hover:bg-secondary-200" onClick={onCancel}>Cancel</button>
          <button type="submit" className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700">Save</button>
        </div>
      )}
    </form>
  )
}

function EditEscalation({ initialDays, initialTemplate, onSave, onCancel }) {
  const [escalationDays, setEscalationDays] = useState(initialDays)
  const [escalationTemplate, setEscalationTemplate] = useState(initialTemplate)
  const changed = escalationDays !== initialDays || escalationTemplate !== initialTemplate
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(escalationDays, escalationTemplate); }}>
      <EditableRow
        label="Escalation Days Overdue"
        value={escalationDays}
        type="number"
        min={1}
        max={60}
        onChange={setEscalationDays}
      />
      <EditableRow
        label="Escalation Message"
        value={escalationTemplate}
        textarea
        help="Available variables: {clientName}, {amount}, {dueDate}, {invoiceNumber}, {daysOverdue}"
        onChange={setEscalationTemplate}
      />
      {changed && (
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" className="px-4 py-2 rounded-lg bg-secondary-100 text-secondary-700 hover:bg-secondary-200" onClick={onCancel}>Cancel</button>
          <button type="submit" className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700">Save</button>
        </div>
      )}
    </form>
  )
}

function AIAgent() {
  const [agentConfig, setAgentConfigState] = useState(null)
  const [isActive, setIsActive] = useState(false)
  const [stats, setStats] = useState({
    activeReminders: 0,
    pendingFollowUps: 0,
    escalatedCases: 0,
    successfulReminders: 0
  })
  const [editingStep, setEditingStep] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load config from Firestore on mount
  useEffect(() => {
    const fetchConfig = async () => {
      if (!auth.currentUser) return;
      
      try {
        setLoading(true);
        
        // First check if we have config saved in localStorage from onboarding
        const savedConfig = localStorage.getItem(`agent_config_${auth.currentUser.uid}`);
        if (savedConfig) {
          try {
            const parsedConfig = JSON.parse(savedConfig);
            console.log("AIAgent: Loading from localStorage, full config =", parsedConfig);
            console.log("AIAgent: Loading from localStorage, netDays =", parsedConfig.netDays);
            
            // Ensure netDays has a valid value
            if (!parsedConfig.netDays && parsedConfig.netDays !== 0) {
              console.log("AIAgent: Setting default netDays value as it was missing");
              parsedConfig.netDays = 14; // Default value
            }
            
            // Set the config state first
            setAgentConfigState(parsedConfig);
            
            // Then save to Firebase - IMPORTANT: only remove localStorage after successful save
            try {
              await setAgentConfig(auth.currentUser.uid, parsedConfig);
              console.log("AIAgent: Successfully saved localStorage config to Firebase with netDays =", parsedConfig.netDays);
              // Only remove from localStorage after confirmed save to Firebase
              localStorage.removeItem(`agent_config_${auth.currentUser.uid}`);
            } catch (saveError) {
              console.error("Error saving config from localStorage to Firebase:", saveError);
              // Keep localStorage data since we couldn't save to Firebase
            }
          } catch (e) {
            console.error("Error parsing config from localStorage:", e);
            // Fall back to Firebase if localStorage parsing fails
            const fbConfig = await getAgentConfig(auth.currentUser.uid);
            handleFirebaseConfig(fbConfig);
          }
        } else {
          // Fall back to Firebase if no localStorage config
          const fbConfig = await getAgentConfig(auth.currentUser.uid);
          handleFirebaseConfig(fbConfig);
        }
      } catch (error) {
        console.error("Error fetching agent config:", error);
      } finally {
        setLoading(false);
      }
    }
    
    const handleFirebaseConfig = (fbConfig) => {
      console.log("AIAgent: Loading from Firebase, raw config =", fbConfig);
      if (fbConfig) {
        // Map Firebase field names to component field names if needed
        const mappedConfig = {
          ...fbConfig,
          // Map the field names that differ between Firebase and component
          netDays: fbConfig.netDays === 0 ? 0 : parseInt(fbConfig.netDays || 14, 10),
          reminderDaysBefore: parseInt(fbConfig.initialReminderDays || 3, 10),
          followupInterval: parseInt(fbConfig.followUpIntervalDays || 3, 10),
          maxFollowups: parseInt(fbConfig.maxFollowUps || 3, 10),
          escalationDays: parseInt(fbConfig.escalationThresholdDays || 14, 10),
          // Ensure these fields exist with default values if not present
          reminderEnabled: fbConfig.reminderEnabled !== false,
          templates: fbConfig.templates || {
            initial: "Dear {clientName}, this is a friendly reminder that your invoice #{invoiceNumber} for ${amount} is due on {dueDate}. Please ensure timely payment to avoid any late fees.",
            followUp: "Dear {clientName}, your invoice #{invoiceNumber} for ${amount} is now {daysOverdue} days overdue. Please process the payment as soon as possible.",
            escalation: "Dear {clientName}, your invoice #{invoiceNumber} for ${amount} is now {daysOverdue} days overdue. This is our final notice before we take further action. Please contact us immediately to resolve this matter."
          }
        };
        console.log("AIAgent: After mapping, netDays =", mappedConfig.netDays);
        setAgentConfigState(mappedConfig);
      }
    }
    
    fetchConfig()
  }, [])

  // Save config to Firestore whenever it changes
  const handleSaveConfig = async (config) => {
    const user = auth.currentUser
    if (user) {
      // Map the component field names to Firebase field names
      const firebaseConfig = {
        ...config,
        // Ensure Firebase-expected field names are present
        initialReminderDays: config.reminderDaysBefore,
        followUpIntervalDays: config.followupInterval,
        maxFollowUps: config.maxFollowups,
        escalationThresholdDays: config.escalationDays,
        netDays: config.netDays === 0 ? 0 : (config.netDays || 14), // Handle netDays=0 explicitly
        // Include other fields
        templates: config.templates || {
          initial: "Dear {clientName}, this is a friendly reminder that your invoice #{invoiceNumber} for ${amount} is due on {dueDate}. Please ensure timely payment to avoid any late fees.",
          followUp: "Dear {clientName}, your invoice #{invoiceNumber} for ${amount} is now {daysOverdue} days overdue. Please process the payment as soon as possible.",
          escalation: "Dear {clientName}, your invoice #{invoiceNumber} for ${amount} is now {daysOverdue} days overdue. This is our final notice before we take further action. Please contact us immediately to resolve this matter."
        },
        useEmail: config.useEmail !== false,
        useSMS: config.useSMS || false
      };
      
      console.log("AIAgent: Saving to Firebase with netDays =", firebaseConfig.netDays);
      
      await setAgentConfig(user.uid, firebaseConfig)
      setAgentConfigState(config)
    }
  }

  // Inline edit handlers
  const handleInlineSave = (updates) => {
    const newConfig = { ...agentConfig };
    for (const key in updates) {
      if (key === 'reminderTemplate') {
        newConfig.templates = { ...newConfig.templates, initial: updates[key] };
      } else if (key === 'followupTemplate') {
        newConfig.templates = { ...newConfig.templates, followUp: updates[key] };
      } else if (key === 'escalationTemplate') {
        newConfig.templates = { ...newConfig.templates, escalation: updates[key] };
      } else if (key === 'netDays') {
        // Special handling for netDays=0
        newConfig[key] = updates[key] === 0 || updates[key] === '0' ? 0 : Number(updates[key]);
      } else {
        newConfig[key] = Number.isNaN(Number(updates[key])) ? updates[key] : Number(updates[key]);
      }
    }

    // If netDays is being updated, always set reminderDaysBefore to a valid value
    if (Object.prototype.hasOwnProperty.call(updates, 'netDays')) {
      const netDays = Number(updates.netDays);
      if (netDays <= 1) {
        newConfig.reminderDaysBefore = 1;
      } else {
        newConfig.reminderDaysBefore = Math.max(1, netDays - 1);
      }
      // Special case: if netDays is set to 1, disable reminders as they can't work
      if (netDays === 1) {
        newConfig.reminderEnabled = false;
        console.log("Setting reminderEnabled to false because netDays is 1");
      }
    }

    // First update local state for immediate feedback
    setAgentConfigState(newConfig);
    
    // Then persist to Firebase (no need to await, can happen in background)
    handleSaveConfig(newConfig);
  }

  if (loading) {
    return <div className="min-h-[300px] flex items-center justify-center text-lg text-secondary-600">Loading agent config...</div>
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl shadow-soft p-6 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary-100 text-primary-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-secondary-900">AI Agent</h2>
              <p className="text-secondary-600 mt-1">Automate invoice reminders and follow-ups</p>
            </div>
          </div>
          
          {agentConfig && (
            <div className="flex items-center space-x-4 mt-4 md:mt-0 self-stretch md:self-auto">
              <button
                onClick={() => setIsActive(!isActive)}
                className={`px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2 ${
                  isActive
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isActive ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </>
                  )}
                </svg>
                <span>{isActive ? 'Stop Agent' : 'Start Agent'}</span>
              </button>
              {!editingStep && (
                <button
                  onClick={() => setAgentConfigState(null)}
                  className="px-4 py-2 rounded-lg bg-secondary-100 text-secondary-700 hover:bg-secondary-200 border border-secondary-300 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Reconfigure
                </button>
              )}
            </div>
          )}
        </div>
        
        {agentConfig && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-primary-50 rounded-lg p-3 text-center">
              <p className="text-xs text-primary-600 uppercase font-medium">Status</p>
              <p className={`text-lg font-bold ${isActive ? 'text-green-600' : 'text-secondary-600'}`}>
                {isActive ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div className="bg-secondary-50 rounded-lg p-3 text-center">
              <p className="text-xs text-secondary-600 uppercase font-medium">Payment Terms</p>
              <p className="text-lg font-bold text-secondary-800">Net {agentConfig.netDays === 0 ? 'Due immediately' : `${agentConfig.netDays || 14} days`}</p>
            </div>
            <div className="bg-secondary-50 rounded-lg p-3 text-center">
              <p className="text-xs text-secondary-600 uppercase font-medium">Follow-ups</p>
              <p className="text-lg font-bold text-secondary-800">{agentConfig.maxFollowups || 3} max</p>
            </div>
            <div className="bg-secondary-50 rounded-lg p-3 text-center">
              <p className="text-xs text-secondary-600 uppercase font-medium">Escalation</p>
              <p className="text-lg font-bold text-secondary-800">After {agentConfig.escalationDays || 14} days</p>
            </div>
          </div>
        )}
      </div>

      {/* Show onboarding wizard if not configured */}
      {!agentConfig && (
        <OnboardingConfig onSave={handleSaveConfig} initialConfig={agentConfig} />
      )}

      {/* Show summary if configured and not editing */}
      {agentConfig && (
        <div className="bg-white rounded-2xl shadow-soft p-8 mt-4">
          <h3 className="text-xl font-semibold text-primary-700 mb-4">Agent Configuration Summary</h3>
          <ul className="list-disc pl-6 space-y-2 text-secondary-800">
            <li>
              <span className="font-medium">Invoice Terms:</span> {agentConfig.netDays === 0
                ? <span>Your customer must pay <b>immediately upon receipt of the invoice.</b></span>
                : <>Your customer will have <b>{agentConfig.netDays || 14} days</b> to pay after receiving the invoice.</>}
              <button className="ml-2 text-secondary-400 hover:text-primary-600" onClick={() => setEditingStep('netDays')} title="Edit"><span role="img" aria-label="edit">✏️</span></button>
            </li>
            {agentConfig.reminderEnabled && agentConfig.netDays > 1 ? (
              <li>
                <span className="font-medium">Initial Reminder:</span> We'll remind them{' '}
                <b>{agentConfig.reminderDaysBefore || 3} days before</b> it's due.
                <button className="ml-2 text-secondary-400 hover:text-primary-600" onClick={() => setEditingStep('reminder')} title="Edit"><span role="img" aria-label="edit">✏️</span></button>
              </li>
            ) : (
              <li>
                <span className="font-medium">Initial Reminder:</span>{' '}
                {agentConfig.netDays === 0 ? (
                  <span className="text-orange-600">Not available for invoice terms of less than 1 day.</span>
                ) : agentConfig.netDays === 1 ? (
                  <span className="text-orange-600">Not available for 1-day invoice terms.</span>
                ) : (
                  <span>Disabled</span>
                )}
                {agentConfig.netDays > 1 && (
                  <button className="ml-2 text-secondary-400 hover:text-primary-600" onClick={() => setEditingStep('reminder')} title="Edit"><span role="img" aria-label="edit">✏️</span></button>
                )}
              </li>
            )}
            <li>
              <span className="font-medium">Follow-up Reminders:</span> If they don't pay, we'll remind them every{' '}
              <b>{agentConfig.followupInterval || 3} days</b>, up to <b>{agentConfig.maxFollowups || 3} times</b>.
              <button className="ml-2 text-secondary-400 hover:text-primary-600" onClick={() => setEditingStep('followup')} title="Edit"><span role="img" aria-label="edit">✏️</span></button>
            </li>
            <li>
              <span className="font-medium">Escalation:</span> If they still haven't paid after{' '}
              <b>{agentConfig.escalationDays || 14} days overdue</b>, we'll let you know or take further action.
              <button className="ml-2 text-secondary-400 hover:text-primary-600" onClick={() => setEditingStep('escalation')} title="Edit"><span role="img" aria-label="edit">✏️</span></button>
            </li>
          </ul>
        </div>
      )}

      {/* Drawer modal for editing steps */}
      <Drawer
        isOpen={!!editingStep}
        onClose={() => setEditingStep(null)}
        title={
          editingStep === 'netDays' ? 'Edit Invoice Terms' :
          editingStep === 'reminder' ? 'Edit Initial Reminder' :
          editingStep === 'followup' ? 'Edit Follow-up Reminders' :
          editingStep === 'escalation' ? 'Edit Escalation' : ''
        }
      >
        {editingStep === 'netDays' && (
          <EditNetDays
            initialValue={agentConfig.netDays}
            onSave={v => { handleInlineSave({ netDays: v }); setEditingStep(null); }}
            onCancel={() => setEditingStep(null)}
          />
        )}
        {editingStep === 'reminder' && (
          <EditReminder
            initialDays={agentConfig.reminderDaysBefore}
            initialTemplate={agentConfig.templates.initial}
            maxDays={agentConfig.netDays}
            onSave={(days, template) => { 
              handleInlineSave({ 
                reminderDaysBefore: days, 
                reminderTemplate: template 
              }); 
              setEditingStep(null); 
            }}
            onCancel={() => setEditingStep(null)}
          />
        )}
        {editingStep === 'followup' && (
          <EditFollowup
            initialInterval={agentConfig.followupInterval}
            initialMax={agentConfig.maxFollowups}
            initialTemplate={agentConfig.templates.followUp}
            onSave={(interval, max, template) => { 
              handleInlineSave({ 
                followupInterval: interval, 
                maxFollowups: max, 
                followupTemplate: template 
              }); 
              setEditingStep(null); 
            }}
            onCancel={() => setEditingStep(null)}
          />
        )}
        {editingStep === 'escalation' && (
          <EditEscalation
            initialDays={agentConfig.escalationDays}
            initialTemplate={agentConfig.templates.escalation}
            onSave={(days, template) => { 
              handleInlineSave({ 
                escalationDays: days, 
                escalationTemplate: template 
              }); 
              setEditingStep(null); 
            }}
            onCancel={() => setEditingStep(null)}
          />
        )}
      </Drawer>
    </div>
  )
}

export default AIAgent 