// Popup script for handling user interactions
class AssignmentEstimator {
    constructor() {
        console.log('[Popup] Initializing AssignmentEstimator');
        this.initializeElements();
        this.bindEvents();
        this.checkCurrentPage();
    }

    initializeElements() {
        console.log('[Popup] Initializing DOM elements');
        this.analyzeBtn = document.getElementById('analyze-btn');
        this.status = document.getElementById('status');
        this.assignmentsContainer = document.getElementById('assignments-container');
        this.assignmentsList = document.getElementById('assignments-list');
        this.totalTime = document.getElementById('total-time');
        this.settingsLink = document.getElementById('settings-link');
        
        console.log('[Popup] DOM elements initialized:', {
            analyzeBtn: !!this.analyzeBtn,
            status: !!this.status,
            assignmentsContainer: !!this.assignmentsContainer,
            assignmentsList: !!this.assignmentsList,
            totalTime: !!this.totalTime,
            settingsLink: !!this.settingsLink
        });
    }

    bindEvents() {
        console.log('[Popup] Binding event listeners');
        this.analyzeBtn.addEventListener('click', () => {
            console.log('[Popup] Analyze button clicked');
            this.analyzeAssignments();
        });
        this.settingsLink.addEventListener('click', () => {
            console.log('[Popup] Settings link clicked');
            this.openSettings();
        });
    }

    async checkCurrentPage() {
        console.log('[Popup] Checking current page');
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            console.log('[Popup] Current tab:', tab);
            console.log('[Popup] Current URL:', tab.url);
            
            if (!tab.url.includes('instructure.com') && !tab.url.includes('canvas.com')) {
                console.warn('[Popup] Not on a Canvas page');
                this.showStatus('error', 'Please navigate to a Canvas page first');
                this.analyzeBtn.disabled = true;
                return;
            }

            console.log('[Popup] On Canvas page, proceeding');
            // Update button text based on page type
            const pageInfo = this.getPageTypeInfo(tab.url);
            console.log('[Popup] Page info:', pageInfo);
            this.analyzeBtn.textContent = pageInfo.buttonText;
            
            // Show helpful hint
            if (pageInfo.hint) {
                console.log('[Popup] Showing page hint');
                this.showStatus('info', pageInfo.hint);
            }

        } catch (error) {
            console.error('[Popup] Error checking current page:', error);
        }
    }

    getPageTypeInfo(url) {
        console.log('[Popup] Getting page type info for URL:', url);
        const path = new URL(url).pathname;
        console.log('[Popup] URL pathname:', path);
        
        if (path === '/' || path.includes('/dashboard') || url.includes('dashboard')) {
            console.log('[Popup] Detected dashboard page');
            return {
                buttonText: 'Analyze Dashboard Assignments',
                hint: 'This will analyze assignments from your Canvas dashboard'
            };
        } else if (path.includes('/assignments/') && path.match(/\/assignments\/\d+/)) {
            console.log('[Popup] Detected assignment detail page');
            return {
                buttonText: 'Estimate This Assignment',
                hint: 'This will estimate the current assignment you\'re viewing'
            };
        } else if (path.includes('/assignments')) {
            console.log('[Popup] Detected assignments list page');
            return {
                buttonText: 'Analyze Course Assignments',
                hint: 'This will analyze all assignments in this course'
            };
        } else if (path.includes('/modules')) {
            console.log('[Popup] Detected modules page');
            return {
                buttonText: 'Analyze Module Assignments',
                hint: 'This will analyze assignments from course modules'
            };
        } else if (path.match(/\/courses\/\d+$/)) {
            console.log('[Popup] Detected course home page');
            return {
                buttonText: 'Analyze Course Home',
                hint: 'This will look for assignments on the course home page'
            };
        } else {
            console.log('[Popup] Detected other Canvas page');
            return {
                buttonText: 'Analyze Canvas Assignments',
                hint: 'Navigate to assignments, modules, or dashboard for best results'
            };
        }
    }

    async analyzeAssignments() {
        console.log('[Popup] Starting assignment analysis');
        try {
            this.showStatus('loading', 'Scanning Canvas page for assignments...');
            this.analyzeBtn.disabled = true;

            // Check if we're on a Canvas page
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            console.log('[Popup] Got current tab for analysis:', tab);
            
            if (!tab.url.includes('instructure.com') && !tab.url.includes('canvas.com')) {
                throw new Error('Please navigate to your Canvas page first');
            }

            console.log('[Popup] Sending message to content script');
            // Get Canvas assignments from content script
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getAssignments' });
            console.log('[Popup] Received response from content script:', response);
            
            if (!response.success) {
                console.error('[Popup] Content script returned error:', response.error);
                throw new Error(response.error || 'Failed to fetch assignments');
            }

            console.log('[Popup] Successfully got assignments from content script:', response.assignments);

            // Show page type info
            const pageTypeDisplay = this.getPageTypeDisplay(response.pageType);
            console.log('[Popup] Page type display:', pageTypeDisplay);
            this.showStatus('loading', `Found ${response.assignments.length} assignments on ${pageTypeDisplay}. Analyzing with AI...`);

            // Process assignments with LLM
            console.log('[Popup] Starting LLM estimation for assignments');
            const estimates = await this.getEstimates(response.assignments);
            console.log('[Popup] Completed LLM estimation:', estimates);
            
            this.displayResults(estimates, response.pageType);
            this.showStatus('success', `Analysis complete! Found ${estimates.length} assignments from ${pageTypeDisplay}`);

        } catch (error) {
            console.error('[Popup] Error analyzing assignments:', error);
            this.showStatus('error', error.message);
            
            // Provide helpful suggestions based on error
            if (error.message.includes('No assignments found')) {
                console.log('[Popup] Showing navigation suggestions');
                setTimeout(() => {
                    this.showStatus('info', 'Try: Canvas Dashboard → Assignments → Modules → Course Pages');
                }, 3000);
            }
        } finally {
            console.log('[Popup] Re-enabling analyze button');
            this.analyzeBtn.disabled = false;
        }
    }

    async getEstimates(assignments) {
        console.log('[Popup] Getting estimates for assignments:', assignments);
        const estimates = [];
        
        for (let i = 0; i < assignments.length; i++) {
            const assignment = assignments[i];
            console.log(`[Popup] Processing assignment ${i + 1}/${assignments.length}:`, assignment);
            
            try {
                const estimate = await this.estimateAssignment(assignment);
                console.log(`[Popup] Got estimate for assignment "${assignment.title}":`, estimate);
                estimates.push({ ...assignment, estimate });
            } catch (error) {
                console.error(`[Popup] Error estimating assignment ${assignment.title}:`, error);
                estimates.push({ ...assignment, estimate: 'Error' });
            }
        }
        
        console.log('[Popup] All estimates completed:', estimates);
        return estimates;
    }

    async estimateAssignment(assignment) {
        console.log('[Popup] Sending assignment to background script for estimation:', assignment);
        // Send to background script for LLM API call
        const response = await chrome.runtime.sendMessage({
            action: 'estimateTime',
            assignment: assignment
        });

        console.log('[Popup] Received estimate response:', response);
        return response.estimate || 'Unknown';
    }

    getPageTypeDisplay(pageType) {
        const displays = {
            'dashboard': 'Canvas Dashboard',
            'assignment_detail': 'Assignment Page',
            'assignments_list': 'Assignments List',
            'modules': 'Course Modules',
            'syllabus': 'Course Syllabus',
            'course_home': 'Course Home',
            'other': 'Canvas Page'
        };
        return displays[pageType] || 'Canvas Page';
    }

    displayResults(estimates, pageType) {
        this.assignmentsList.innerHTML = '';
        let totalHours = 0;

        estimates.forEach(assignment => {
            const item = document.createElement('div');
            item.className = 'assignment-item';
            
            const estimateHours = typeof assignment.estimate === 'number' ? assignment.estimate : 0;
            totalHours += estimateHours;

            // Show course info if available and from dashboard
            const courseInfo = assignment.course && pageType === 'dashboard' 
                ? `<div style="font-size: 11px; color: #888; margin-bottom: 3px;">📚 ${assignment.course}</div>`
                : '';

            // Show source info for debugging
            const sourceInfo = assignment.source 
                ? `<div style="font-size: 10px; color: #aaa; margin-top: 5px;">Source: ${assignment.source}</div>`
                : '';

            item.innerHTML = `
                ${courseInfo}
                <div class="assignment-title">${assignment.title}</div>
                <div class="assignment-estimate">⏱️ ${assignment.estimate} ${typeof assignment.estimate === 'number' ? 'hours' : ''}</div>
                <div class="assignment-due">📅 Due: ${assignment.dueDate || 'No due date'}</div>
                ${assignment.description ? `<div style="font-size: 12px; color: #666; margin-top: 5px;">${assignment.description.substring(0, 100)}...</div>` : ''}
                ${sourceInfo}
            `;
            
            this.assignmentsList.appendChild(item);
        });

        const pageTypeDisplay = this.getPageTypeDisplay(pageType);
        this.totalTime.innerHTML = `📊 Total estimated time: <span style="color: #1976d2;">${totalHours.toFixed(1)} hours</span><br>
                                   <small style="color: #666;">from ${pageTypeDisplay}</small>`;
        this.assignmentsContainer.style.display = 'block';
    }

    showStatus(type, message) {
        this.status.className = `status ${type}`;
        this.status.textContent = message;
        this.status.style.display = 'block';
        
        if (type === 'success') {
            setTimeout(() => {
                this.status.style.display = 'none';
            }, 3000);
        }
    }

    openSettings() {
        chrome.runtime.openOptionsPage();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AssignmentEstimator();
});