import { useState, useEffect, Fragment } from 'react';

function MoodBoard({ moodData, onCellClick }) {
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile when component mounts
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 600);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Generate dates for the past 12 months up to today
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Start from 12 months ago
    const startDate = new Date(today);
    startDate.setMonth(today.getMonth() - 11);
    startDate.setDate(1); // Start from the 1st day of the month
    
    // Generate all dates up to including today
    const endDate = new Date(today);
    for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
      dates.push(new Date(currentDate));
    }
    
    return dates;
  };

  const dates = generateDates();
  
  // Get date range for display
  const startDateDisplay = dates.length > 0 ? dates[0] : new Date();
  const endDateDisplay = dates.length > 0 ? dates[dates.length - 1] : new Date();
  const dateRangeDisplay = `${startDateDisplay.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} - ${endDateDisplay.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;

  // FOR DESKTOP VIEW: Arrange dates into weeks for full year view
  const arrangeIntoWeeks = () => {
    const weeks = [];
    let currentWeek = [];
    
    // Find the first Monday
    const firstDate = new Date(dates[0]);
    const firstDayOfWeek = firstDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Add empty spots for days before the first Monday
    if (firstDayOfWeek !== 1) {
      const daysToAdd = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
      for (let i = 0; i < daysToAdd; i++) {
        currentWeek.push(null);
      }
    }
    
    // Add all dates to their respective weeks
    dates.forEach((date, i) => {
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      // Rearrange to Monday first (1, 2, 3, 4, 5, 6, 0)
      const adjustedDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      
      // If we're starting a new week
      if (adjustedDayIndex === 0 && currentWeek.length > 0) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
      
      // Add date to current week
      currentWeek[adjustedDayIndex] = date;
      
      // If this is the last date, add the final partial week
      if (i === dates.length - 1) {
        weeks.push([...currentWeek]);
      }
    });
    
    return weeks;
  };
  
  const weeks = arrangeIntoWeeks();
  
  // Month labels for desktop view
  const getDesktopMonthLabels = () => {
    const monthLabels = [];
    let lastMonth = null;
    
    for (let w = 0; w < weeks.length; w++) {
      // Find the first valid date in this week
      const firstValidDate = weeks[w].find(date => date !== null);
      if (firstValidDate) {
        const month = firstValidDate.toLocaleString('default', { month: 'short' });
        if (month !== lastMonth) {
          monthLabels.push({ month, week: w });
          lastMonth = month;
        }
      }
    }
    
    return monthLabels;
  };
  
  const desktopMonthLabels = getDesktopMonthLabels();

  // Group dates by month - keeping the year to avoid confusion
  const groupDatesByMonth = () => {
    const monthGroups = [];
    let currentMonth = null;
    let currentMonthDates = [];
    
    dates.forEach(date => {
      const month = date.getMonth();
      const year = date.getFullYear();
      const monthYear = `${month}-${year}`;
      
      if (monthYear !== currentMonth) {
        if (currentMonth !== null) {
          monthGroups.push({
            month: currentMonth,
            dates: [...currentMonthDates],
            label: new Date(parseInt(currentMonth.split('-')[1]), parseInt(currentMonth.split('-')[0]), 1)
              .toLocaleString('default', { month: 'long', year: 'numeric' })
          });
          currentMonthDates = [];
        }
        currentMonth = monthYear;
      }
      
      currentMonthDates.push(date);
    });
    
    // Add the last month
    if (currentMonth !== null && currentMonthDates.length > 0) {
      monthGroups.push({
        month: currentMonth,
        dates: [...currentMonthDates],
        label: new Date(parseInt(currentMonth.split('-')[1]), parseInt(currentMonth.split('-')[0]), 1)
          .toLocaleString('default', { month: 'long', year: 'numeric' })
      });
    }
    
    // Reverse so most recent month comes first
    return monthGroups.reverse();
  };
  
  const monthGroups = groupDatesByMonth();
  
  // Arrange dates into calendar (filling in days to complete the calendar)
  const getMonthCalendar = (monthDates) => {
    if (!monthDates || monthDates.length === 0) return { weeks: [], monthLabelCells: [] };
    
    // Get first day of the month
    const firstDate = new Date(monthDates[0]);
    const firstDay = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
    
    // Get last day of the month
    const lastDay = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0);
    
    // Determine the number of rows needed for this month
    // First, figure out what day of the week the 1st falls on (0-6, Sunday-Saturday)
    const firstDayOfWeek = firstDay.getDay();
    // Adjust to our grid where Monday is 0
    const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    // Calculate total spaces needed (days in month + empty spaces before first day)
    const daysInMonth = lastDay.getDate();
    const totalSpacesNeeded = adjustedFirstDay + daysInMonth;
    
    // Determine number of weeks (rows) needed (ceiling division by 7)
    const numberOfWeeks = Math.ceil(totalSpacesNeeded / 7);
    
    // Create a grid with exactly the right number of rows
    const calendarGrid = Array(numberOfWeeks * 7).fill(null);
    
    // Fill in all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(firstDate.getFullYear(), firstDate.getMonth(), day);
      // Calculate position: day index = adjusted first day offset + (day - 1)
      const dayIndex = adjustedFirstDay + (day - 1);
      
      // Only add dates up to today
      if (date <= new Date()) {
        calendarGrid[dayIndex] = date;
      }
    }
    
    // Divide into weeks
    const weeks = [];
    for (let i = 0; i < numberOfWeeks; i++) {
      const week = calendarGrid.slice(i * 7, (i + 1) * 7);
      weeks.push(week);
    }
    
    // Generate month label
    const monthLabelCells = [{
      month: firstDate.toLocaleString('default', { month: 'short' }),
      week: 0
    }];
    
    return { weeks, monthLabelCells };
  };

  // Get current month to display
  const currentDisplayMonth = monthGroups[currentMonthIndex] || { dates: [], label: '' };
  const currentCalendar = getMonthCalendar(currentDisplayMonth.dates);
  
  // Weekday labels (Mon-Sun)
  const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Functions to navigate between months
  const goToPreviousMonth = () => {
    if (currentMonthIndex < monthGroups.length - 1) {
      setCurrentMonthIndex(currentMonthIndex + 1);
    }
  };
  
  const goToNextMonth = () => {
    if (currentMonthIndex > 0) {
      setCurrentMonthIndex(currentMonthIndex - 1);
    }
  };
  
  const goToCurrentMonth = () => {
    setCurrentMonthIndex(0);
  };

  return (
    <div className="mood-board-container">
      <div className="mood-date-range">
        {!isMobile && <span>{dateRangeDisplay}</span>}
        {isMobile && (
          <div className="month-navigation">
            <button 
              className="month-nav-button" 
              onClick={goToPreviousMonth}
              disabled={currentMonthIndex >= monthGroups.length - 1}
              aria-label="Previous month"
            >
              &#8592;
            </button>
            <span className="current-month-label">{currentDisplayMonth.label}</span>
            <button 
              className="month-nav-button" 
              onClick={goToNextMonth}
              disabled={currentMonthIndex <= 0}
              aria-label="Next month"
            >
              &#8594;
            </button>
            <button 
              className="month-nav-button today-button" 
              onClick={goToCurrentMonth}
              disabled={currentMonthIndex === 0}
            >
              Today
            </button>
          </div>
        )}
      </div>
      <div className="mood-board-outer">
        <div className="mood-board-grid">
          {/* Month labels row */}
          <div className="empty-label" />
          {(isMobile ? currentCalendar.weeks : weeks).map((_, weekIdx) => {
            const label = isMobile 
              ? currentCalendar.monthLabelCells.find((m) => m.week === weekIdx)
              : desktopMonthLabels.find((m) => m.week === weekIdx);
            return (
              <div key={weekIdx} className="month-label-cell">
                {label ? label.month : ''}
              </div>
            );
          })}
          {/* Weekday labels and mood cells */}
          {Array.from({ length: 7 }).map((_, dayIdx) => (
            <Fragment key={dayIdx}>
              <div className="weekday-label">{weekdayLabels[dayIdx]}</div>
              {(isMobile ? currentCalendar.weeks : weeks).map((week, weekIdx) => {
                const date = week ? week[dayIdx] : null;
                if (!date) return <div key={weekIdx + '-' + dayIdx} className="mood-cell empty" />;
                const dateString = date.toISOString().split('T')[0];
                const moodEntry = moodData[dateString];
                const moodLevel = moodEntry ? moodEntry.level : 0;
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={dateString}
                    className={`mood-cell mood-${moodLevel}${isToday ? ' today' : ''}`}
                    onClick={() => onCellClick(date)}
                    title={`${date.toLocaleDateString()}${moodEntry ? ` - Mood: ${moodLevel}${moodEntry.notes ? `\nNotes: ${moodEntry.notes}` : ''}` : ''}`}
                    data-date={date.getDate()}
                  >
                    {isMobile && moodLevel > 0 && (
                      <span className="mood-value">{moodLevel}</span>
                    )}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MoodBoard; 