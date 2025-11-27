// Content script for extracting Canvas assignment data from multiple page types
class CanvasAssignmentExtractor {
    constructor() {
        this.pageType = this.detectPageType();
        this.setupMessageListener();
        console.log(`[Canvas Extractor] Initialized on ${this.pageType} page`);
        console.log(`[Canvas Extractor] Current URL: ${window.location.href}`);
        console.log(`[Canvas Extractor] Page pathname: ${window.location.pathname}`);
    }

    detectPageType() {
        const path = window.location.pathname;
        const url = window.location.href;
        
        console.log(`[Canvas Extractor] Detecting page type for path: ${path}`);
        
        if (path.includes('/assignments/') && path.match(/\/assignments\/\d+/)) {
            console.log(`[Canvas Extractor] Detected: assignment_detail`);
            return 'assignment_detail';
        } else if (path.includes('/assignments')) {
            console.log(`[Canvas Extractor] Detected: assignments_list`);
            return 'assignments_list';
        } else if (path.includes('/modules')) {
            console.log(`[Canvas Extractor] Detected: modules`);
            return 'modules';
        } else if (path.includes('/assignments/syllabus')) {
            console.log(`[Canvas Extractor] Detected: syllabus`);
            return 'syllabus';
        } else if (path === '/' || path.includes('/dashboard') || url.includes('dashboard')) {
            console.log(`[Canvas Extractor] Detected: dashboard`);
            return 'dashboard';
        } else if (path.match(/\/courses\/\d+$/)) {
            console.log(`[Canvas Extractor] Detected: course_home`);
            return 'course_home';
        } else {
            console.log(`[Canvas Extractor] Detected: other`);
            return 'other';
        }
    }

    setupMessageListener() {
        console.log(`[Canvas Extractor] Setting up message listener`);
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log(`[Canvas Extractor] Received message:`, request);
            if (request.action === 'getAssignments') {
                console.log(`[Canvas Extractor] Starting assignment extraction...`);
                this.extractAssignments()
                    .then(assignments => {
                        console.log(`[Canvas Extractor] Successfully extracted ${assignments.length} assignments:`, assignments);
                        sendResponse({ success: true, assignments, pageType: this.pageType });
                    })
                    .catch(error => {
                        console.error('[Canvas Extractor] Error extracting assignments:', error);
                        sendResponse({ success: false, error: error.message, pageType: this.pageType });
                    });
                return true; // Keep message channel open for async response
            }
        });
    }

    async extractAssignments() {
        console.log(`[Canvas Extractor] Starting Canvas assignment extraction on ${this.pageType} page...`);
        console.log(`[Canvas Extractor] Full URL: ${window.location.href}`);
        console.log(`[Canvas Extractor] Page title: ${document.title}`);
        console.log(`[Canvas Extractor] Document ready state: ${document.readyState}`);
        
        // Wait for page to load completely
        console.log(`[Canvas Extractor] Waiting for page body to load...`);
        await this.waitForElement('body', 5000);
        console.log(`[Canvas Extractor] Page body loaded, proceeding with extraction`);

        // Debug: Show what's actually on the page
        console.log(`[Canvas Extractor] Page HTML preview:`, document.body.innerHTML.substring(0, 500));
        console.log(`[Canvas Extractor] All elements with "assignment" in class/id:`, 
            document.querySelectorAll('[class*="assignment"], [id*="assignment"]'));
        console.log(`[Canvas Extractor] All links containing "assignment":`, 
            document.querySelectorAll('a[href*="assignment"]'));

        let assignments = [];

        // Route to appropriate extraction method based on page type
        console.log(`[Canvas Extractor] Routing to extraction method for ${this.pageType}`);
        switch (this.pageType) {
            case 'dashboard':
                console.log(`[Canvas Extractor] Calling extractFromDashboard()`);
                assignments = await this.extractFromDashboard();
                break;
            case 'assignment_detail':
                console.log(`[Canvas Extractor] Calling extractFromAssignmentDetail()`);
                assignments = await this.extractFromAssignmentDetail();
                break;
            case 'assignments_list':
                console.log(`[Canvas Extractor] Calling extractFromAssignmentList()`);
                assignments = this.extractFromAssignmentList();
                break;
            case 'modules':
                console.log(`[Canvas Extractor] Calling extractFromModules()`);
                assignments = this.extractFromModules();
                break;
            case 'syllabus':
                console.log(`[Canvas Extractor] Calling extractFromSyllabus()`);
                assignments = this.extractFromSyllabus();
                break;
            case 'course_home':
                console.log(`[Canvas Extractor] Calling extractFromCourseHome()`);
                assignments = await this.extractFromCourseHome();
                break;
            default:
                console.log(`[Canvas Extractor] Using fallback extraction methods`);
                // Try all methods as fallback with better logging
                console.log(`[Canvas Extractor] Trying extractFromAssignmentList()`);
                assignments = this.extractFromAssignmentList();
                if (assignments.length === 0) {
                    console.log(`[Canvas Extractor] Trying extractFromModules()`);
                    assignments = this.extractFromModules();
                }
                if (assignments.length === 0) {
                    console.log(`[Canvas Extractor] Trying extractFromSyllabus()`);
                    assignments = this.extractFromSyllabus();
                }
                if (assignments.length === 0) {
                    console.log(`[Canvas Extractor] Trying extractFromDashboard()`);
                    assignments = await this.extractFromDashboard();
                }
        }

        console.log(`[Canvas Extractor] Raw extraction result:`, assignments);

        // Ensure assignments is always an array
        if (!assignments || !Array.isArray(assignments)) {
            console.warn(`[Canvas Extractor] Assignments is not an array, converting:`, assignments);
            assignments = [];
        }

        console.log(`[Canvas Extractor] Final assignments array length: ${assignments.length}`);

        if (assignments.length === 0) {
            // Enhanced error message with page analysis
            console.error(`[Canvas Extractor] No assignments found on this ${this.pageType} page`);
            console.log(`[Canvas Extractor] Page analysis:`);
            console.log(`- URL: ${window.location.href}`);
            console.log(`- Title: ${document.title}`);
            console.log(`- Page type detected: ${this.pageType}`);
            console.log(`- Assignment links found: ${document.querySelectorAll('a[href*="assignment"]').length}`);
            console.log(`- Elements with "assignment" in class: ${document.querySelectorAll('[class*="assignment"]').length}`);
            
            throw new Error(`No assignments found on this ${this.pageType} page. Page analysis: Found ${document.querySelectorAll('a[href*="assignment"]').length} assignment links. Try navigating to your Canvas assignments list, course modules, or a different Canvas page.`);
        }

        console.log(`[Canvas Extractor] Successfully found ${assignments.length} assignments on ${this.pageType} page`);
        return assignments;
    }

    async extractFromDashboard() {
        console.log(`[Canvas Extractor] Starting dashboard extraction`);
        const assignments = [];
        
        // First, let's add a broader search for ANY assignment-related content
        console.log(`[Canvas Extractor] Performing broad assignment search`);
        const allAssignmentLinks = document.querySelectorAll('a[href*="assignment"]');
        console.log(`[Canvas Extractor] Found ${allAssignmentLinks.length} total assignment links on page`);
        
        // If we find any assignment links, extract them with enhanced metadata extraction
        if (allAssignmentLinks.length > 0) {
            console.log(`[Canvas Extractor] Processing all assignment links as fallback`);
            allAssignmentLinks.forEach((link, index) => {
                console.log(`[Canvas Extractor] Processing fallback assignment link ${index + 1}:`, link);
                
                // Skip if it's not actually an assignment link
                if (!link.href.includes('/assignments/')) return;
                
                // Find multiple levels of parent elements to extract metadata
                const immediateParent = link.closest('li, tr, div[class], [role="listitem"]');
                const containerParent = link.closest('[class*="item"], [class*="card"], [class*="event"], [class*="todo"], [class*="stream"], [class*="activity"]');
                const broadParent = link.closest('[class*="dashboard"], [class*="coming"], [class*="upcoming"], [class*="recent"]');
                
                console.log(`[Canvas Extractor] Parent elements:`, {
                    immediate: immediateParent,
                    container: containerParent,
                    broad: broadParent
                });
                
                let dueDate = null;
                let course = 'Unknown Course';
                let points = null;
                
                // Extract course from assignment title if it contains course codes
                const titleText = link.textContent.trim();
                
                // Look for course codes in the title (like "CPT_S-437-PULLM-1-LEC" or "MATH-101")
                const courseCodeMatch = titleText.match(/([A-Z]{2,8}[_\s-]\w*-\d{3}(?:-\w+)*)/i);
                if (courseCodeMatch) {
                    course = courseCodeMatch[1].replace(/_/g, ' ').replace(/-/g, ' ').trim();
                    console.log(`[Canvas Extractor] Found course code in title: ${course}`);
                }
                
                // Try to extract course name from various parent levels
                const courseSelectors = [
                    '.course-name', '.context-name', '[class*="course"]',
                    '.class-name', '.subject', '[data-course]'
                ];
                
                for (const parent of [immediateParent, containerParent, broadParent]) {
                    if (!parent || course !== 'Unknown Course') break;
                    
                    for (const selector of courseSelectors) {
                        const courseElement = parent.querySelector(selector);
                        if (courseElement && courseElement.textContent.trim()) {
                            console.log(`[Canvas Extractor] Found course element with selector "${selector}":`, courseElement);
                            const courseText = courseElement.textContent.trim();
                            if (!courseText.includes('GPA') && !courseText.includes('Cumulative')) {
                                course = courseText;
                                console.log(`[Canvas Extractor] Using course from parent: ${course}`);
                                break;
                            }
                        }
                    }
                }

// Extract course from assignment URL if not found elsewhere
                if (course === 'Unknown Course') {
                    const courseMatch = link.href.match(/\/courses\/(\d+)/);
                    if (courseMatch) {
                        const courseId = courseMatch[1];
                        console.log(`[Canvas Extractor] Found course ID: ${courseId}`);
                        
                        // Try to find course name from navigation or breadcrumbs
                        const navCourseElement = document.querySelector('.ic-app-nav-toggle-and-crumbs .course-name, .ic-app-nav-toggle-and-crumbs [data-course-name]');
                        const breadcrumbCourse = document.querySelector('.ic-app-crumbs .course-name, .ic-app-crumbs a[href*="/courses/"]');
                        const courseTitleElement = document.querySelector('h1 .course-title, .course-header .course-title');
                        
                        // For dashboard, try to find course cards and match by course ID
                        const courseCards = document.querySelectorAll('.ic-DashboardCard, .dashboard-card, .course-card');
                        let foundCourseName = null;
                        
                        courseCards.forEach(card => {
                            const cardLink = card.querySelector(`a[href*="/courses/${courseId}"]`);
                            if (cardLink) {
                                const cardTitle = card.querySelector('.ic-DashboardCard__header-title, .card-title, .course-name, .course-title');
                                if (cardTitle && cardTitle.textContent.trim()) {
                                    foundCourseName = cardTitle.textContent.trim();
                                    console.log(`[Canvas Extractor] Found course name from dashboard card: ${foundCourseName}`);
                                }
                            }
                        });
                        
                        if (foundCourseName && !foundCourseName.includes('GPA')) {
                            course = foundCourseName;
                        } else if (navCourseElement && navCourseElement.textContent.trim() && !navCourseElement.textContent.includes('GPA')) {
                            course = navCourseElement.textContent.trim();
                            console.log(`[Canvas Extractor] Found course from nav: ${course}`);
                        } else if (breadcrumbCourse && breadcrumbCourse.textContent.trim() && !breadcrumbCourse.textContent.includes('GPA')) {
                            course = breadcrumbCourse.textContent.trim();
                            console.log(`[Canvas Extractor] Found course from breadcrumb: ${course}`);
                        } else if (courseTitleElement && courseTitleElement.textContent.trim() && !courseTitleElement.textContent.includes('GPA')) {
                            course = courseTitleElement.textContent.trim();
                            console.log(`[Canvas Extractor] Found course from title: ${course}`);
                        } else {
                            // Try to get course name from the assignment's context on the dashboard
                            // Look for assignment in todo lists or upcoming events that might have course context
                            const dashboardItems = document.querySelectorAll('.ic-DashboardCard .ic-DashboardCard__action, .coming-up-list .coming-up-list__item, .todo-list .todo-item');
                            dashboardItems.forEach(item => {
                                const itemLink = item.querySelector(`a[href="${link.href}"]`);
                                if (itemLink) {
                                    const courseContext = item.closest('.ic-DashboardCard, .dashboard-card');
                                    if (courseContext) {
                                        const courseTitle = courseContext.querySelector('.ic-DashboardCard__header-title, .card-title, .course-name');
                                        if (courseTitle && courseTitle.textContent.trim() && !courseTitle.textContent.includes('GPA')) {
                                            course = courseTitle.textContent.trim();
                                            console.log(`[Canvas Extractor] Found course from dashboard context: ${course}`);
                                        }
                                    }
                                }
                            });
                            
                            // Final fallback - use course ID
                            if (course === 'Unknown Course') {
                                course = `Course ${courseId}`;
                                console.log(`[Canvas Extractor] Using course ID as fallback: ${course}`);
                            }
                        }
                    }
                }
                
                // Clean up course name - remove GPA and grade info
                if (course && course.includes('GPA')) {
                    console.log(`[Canvas Extractor] Cleaning course name with GPA data: ${course}`);
                    course = 'Unknown Course'; // Reset if it contains GPA data
                }
                
                // Try to extract due date from various parent levels and selectors
                const dateSelectors = [
                    '.due-date', '.date', '[class*="due"]', '[class*="date"]',
                    '.event-date', '.coming-up-date', '.todo-date',
                    'time', '[datetime]', '.datetime',
                    // Additional date selectors for Canvas
                    '.date_text', '.assignment-due-date', '.due_date_display',
                    '.event-details .date', '.assignment-date-due',
                    '[data-testid="due-date"]', '[data-testid="assignment-due-date"]',
                    // Look for dates in parent text content
                    '.ig-details', '.event-details', '.assignment-details'
                ];
                
                for (const parent of [immediateParent, containerParent, broadParent]) {
                    if (!parent || dueDate) break;
                    
                    // First try specific date elements
                    for (const selector of dateSelectors) {
                        const dateElement = parent.querySelector(selector);
                        if (dateElement && dateElement.textContent.trim()) {
                            console.log(`[Canvas Extractor] Found date element with selector "${selector}":`, dateElement);
                            const dateText = dateElement.textContent.trim();
                            // Skip if it's obviously not a date
                            if (dateText.length > 3 && !dateText.toLowerCase().includes('submit') && !dateText.toLowerCase().includes('turn in')) {
                                dueDate = this.parseDueDate(dateText);
                                if (dueDate) {
                                    console.log(`[Canvas Extractor] Successfully parsed date from element: ${dueDate}`);
                                    break;
                                }
                            }
                        }
                    }
                    
                    // Also check for datetime attributes
                    const timeElement = parent.querySelector('[datetime]');
                    if (timeElement && !dueDate) {
                        console.log(`[Canvas Extractor] Found datetime attribute:`, timeElement.getAttribute('datetime'));
                        dueDate = this.parseDueDate(timeElement.getAttribute('datetime'));
                    }
                    
                    // Try to find dates in parent element's full text content
                    if (!dueDate && parent.textContent) {
                        const parentText = parent.textContent;
                        // Look for date patterns in the text
                        const datePatterns = [
                            /due\s+([A-Za-z]{3,9}\s+\d{1,2}(?:,?\s*\d{4})?)/i,
                            /due\s+(\d{1,2}\/\d{1,2}(?:\/\d{4})?)/i,
                            /([A-Za-z]{3,9}\s+\d{1,2}(?:,?\s*\d{4})?)/,
                            /(\d{1,2}\/\d{1,2}\/\d{4})/,
                            /(\d{1,2}-\d{1,2}-\d{4})/
                        ];
                        
                        for (const pattern of datePatterns) {
                            const match = parentText.match(pattern);
                            if (match) {
                                console.log(`[Canvas Extractor] Found date pattern in parent text: "${match[1]}"`);
                                const testDate = this.parseDueDate(match[1]);
                                if (testDate) {
                                    dueDate = testDate;
                                    console.log(`[Canvas Extractor] Successfully parsed date from parent text: ${dueDate}`);
                                    break;
                                }
                            }
                        }
                    }
                }
                
                // Try to extract points
                const pointsSelectors = [
                    '.points', '[class*="points"]', '[class*="pts"]',
                    '.score', '.grade', '[class*="score"]'
                ];
                
                for (const parent of [immediateParent, containerParent, broadParent]) {
                    if (!parent || points) break;
                    
                    for (const selector of pointsSelectors) {
                        const pointsElement = parent.querySelector(selector);
                        if (pointsElement && pointsElement.textContent.trim()) {
                            console.log(`[Canvas Extractor] Found points element with selector "${selector}":`, pointsElement);
                            points = this.parsePoints(pointsElement.textContent.trim());
                            if (points) break;
                        }
                    }
                }
                
                // Look for due date in the link text itself
                if (!dueDate) {
                    const linkText = link.textContent;
                    const dateInText = linkText.match(/due\s+(.+?)(?:\s|$)/i);
                    if (dateInText) {
                        console.log(`[Canvas Extractor] Found date in link text:`, dateInText[1]);
                        dueDate = this.parseDueDate(dateInText[1]);
                    }
                }
                
                const result = {
                    title: link.textContent.trim(),
                    url: link.href,
                    dueDate: dueDate,
                    course: course,
                    points: points,
                    type: 'assignment',
                    description: null,
                    source: 'dashboard_fallback'
                };
                
                console.log(`[Canvas Extractor] Enhanced fallback assignment result:`, result);
                assignments.push(result);
            });
        }
        
        // Canvas dashboard upcoming assignments (original selectors)
        const upcomingSelectors = [
            '.upcoming_events .event-list .event-list__item',
            '.coming-up-list .coming-up-list__item',
            '[data-testid="coming-up-list"] [data-testid="coming-up-item"]',
            '.dashboard-card .coming-up .event',
            '.ic-DashboardCard__action-list .ic-DashboardCard__action-list-item',
            // Additional modern Canvas selectors
            '.ic-DashboardCard .ic-DashboardCard__action',
            '.dashboard-card .stream-item',
            '.ic-app-main-content .event',
            '.ic-Dashboard-layout .todo-list .todo-item',
            '[role="main"] .event-list li',
            // Generic fallbacks
            '.event-list-item',
            '.assignment-item',
            '.todo-item',
            '[class*="assignment"][class*="item"]'
        ];

        console.log(`[Canvas Extractor] Trying ${upcomingSelectors.length} selectors for upcoming assignments`);
        for (const selector of upcomingSelectors) {
            console.log(`[Canvas Extractor] Trying selector: ${selector}`);
            const elements = document.querySelectorAll(selector);
            console.log(`[Canvas Extractor] Found ${elements.length} elements with selector: ${selector}`);
            
            elements.forEach((element, index) => {
                console.log(`[Canvas Extractor] Processing dashboard element ${index + 1}:`, element);
                const assignment = this.extractAssignmentFromDashboardItem(element);
                if (assignment) {
                    console.log(`[Canvas Extractor] Extracted assignment from dashboard:`, assignment);
                    assignments.push(assignment);
                } else {
                    console.log(`[Canvas Extractor] No assignment extracted from element ${index + 1}`);
                }
            });
            
            if (assignments.length > 0) {
                console.log(`[Canvas Extractor] Found ${assignments.length} assignments, breaking from selector loop`);
                break;
            }
        }

        // Also check for "To Do" items with expanded selectors
        console.log(`[Canvas Extractor] Checking for To Do items`);
        const todoSelectors = [
            '.Sidebar__TodoListItem',
            '.todo-list .todo-item',
            '[data-testid="todo-item"]',
            '.ic-Dashboard-sidebar .todo-item',
            '.right-side .todo-item',
            '.dashboard-sidebar .todo-item',
            '.sidebar .todo-item'
        ];
        
        for (const selector of todoSelectors) {
            const todoItems = document.querySelectorAll(selector);
            console.log(`[Canvas Extractor] Found ${todoItems.length} todo items with selector: ${selector}`);
            todoItems.forEach((item, index) => {
                console.log(`[Canvas Extractor] Processing todo item ${index + 1}:`, item);
                const assignment = this.extractAssignmentFromTodoItem(item);
                if (assignment) {
                    console.log(`[Canvas Extractor] Extracted assignment from todo:`, assignment);
                    assignments.push(assignment);
                }
            });
            if (todoItems.length > 0) break;
        }

        // Check for recent activity assignments with expanded selectors
        console.log(`[Canvas Extractor] Checking for recent activity items`);
        const activitySelectors = [
            '.recent-activity-item',
            '.activity-stream-item',
            '.stream-item',
            '.ic-Dashboard .stream-item',
            '.dashboard-card .stream-item'
        ];
        
        for (const selector of activitySelectors) {
            const activityItems = document.querySelectorAll(selector);
            console.log(`[Canvas Extractor] Found ${activityItems.length} activity items with selector: ${selector}`);
            activityItems.forEach((item, index) => {
                console.log(`[Canvas Extractor] Processing activity item ${index + 1}:`, item);
                const assignment = this.extractAssignmentFromActivityItem(item);
                if (assignment) {
                    console.log(`[Canvas Extractor] Extracted assignment from activity:`, assignment);
                    assignments.push(assignment);
                }
            });
            if (activityItems.length > 0) break;
        }

        console.log(`[Canvas Extractor] Dashboard extraction complete. Found ${assignments.length} total assignments before deduplication`);
        const deduplicated = this.deduplicateAssignments(assignments);
        console.log(`[Canvas Extractor] After deduplication: ${deduplicated.length} assignments`);
        return deduplicated;
    }

    extractAssignmentFromDashboardItem(element) {
        console.log(`[Canvas Extractor] Extracting from dashboard item:`, element);
        
        // Try multiple selectors for title
        const titleSelectors = ['a[href*="/assignments/"]', '.event-title a', '.coming-up-title a', '[data-testid="assignment-link"]'];
        let titleElement = null;
        
        for (const selector of titleSelectors) {
            titleElement = element.querySelector(selector);
            console.log(`[Canvas Extractor] Tried selector "${selector}", found:`, titleElement);
            if (titleElement) break;
        }
        
        if (!titleElement || !titleElement.href.includes('assignment')) {
            console.log(`[Canvas Extractor] No valid title element or assignment link found`);
            return null;
        }

        const dueDateElement = element.querySelector('.event-date, .coming-up-date, [data-testid="due-date"], .date_text');
        const courseElement = element.querySelector('.course-name, .context-name, [data-testid="course-name"]');
        
        console.log(`[Canvas Extractor] Dashboard item elements - title:`, titleElement, 'dueDate:', dueDateElement, 'course:', courseElement);

        const result = {
            title: titleElement.textContent.trim(),
            url: titleElement.href,
            dueDate: dueDateElement ? this.parseDueDate(dueDateElement.textContent.trim()) : null,
            course: courseElement ? courseElement.textContent.trim() : 'Unknown Course',
            points: null,
            type: 'assignment',
            description: null,
            source: 'dashboard'
        };
        
        console.log(`[Canvas Extractor] Dashboard item result:`, result);
        return result;
    }

    extractAssignmentFromTodoItem(element) {
        console.log(`[Canvas Extractor] Extracting from todo item:`, element);
        const titleElement = element.querySelector('a[href*="/assignments/"], .todo-title a');
        if (!titleElement) {
            console.log(`[Canvas Extractor] No valid title element found in todo item`);
            return null;
        }

        const dueDateElement = element.querySelector('.todo-date, .due-date');
        const courseElement = element.querySelector('.course-name, .context-name');

        const result = {
            title: titleElement.textContent.trim(),
            url: titleElement.href,
            dueDate: dueDateElement ? this.parseDueDate(dueDateElement.textContent.trim()) : null,
            course: courseElement ? courseElement.textContent.trim() : 'Unknown Course',
            points: null,
            type: 'assignment',
            description: null,
            source: 'todo'
        };

        console.log(`[Canvas Extractor] Todo item result:`, result);
        return result;
    }

    extractAssignmentFromActivityItem(element) {
        console.log(`[Canvas Extractor] Extracting from activity item:`, element);
        const titleElement = element.querySelector('a[href*="/assignments/"]');
        if (!titleElement) {
            console.log(`[Canvas Extractor] No valid title element found in activity item`);
            return null;
        }

        const result = {
            title: titleElement.textContent.trim(),
            url: titleElement.href,
            dueDate: null,
            course: 'Recent Activity',
            points: null,
            type: 'assignment',
            description: null,
            source: 'activity'
        };

        console.log(`[Canvas Extractor] Activity item result:`, result);
        return result;
    }

    async extractFromAssignmentDetail() {
        console.log(`[Canvas Extractor] Starting assignment detail extraction`);
        const assignments = [];
        
        // Extract details from current assignment page
        const titleElement = document.querySelector('.assignment-title, h1.title, [data-testid="assignment-name"]');
        const descriptionElement = document.querySelector('.assignment_description, .description, [data-testid="assignment-description"]');
        const pointsElement = document.querySelector('.assignment-points-possible, .points, [data-testid="assignment-points"]');
        const dueDateElement = document.querySelector('.assignment-due-date, .due-date, [data-testid="assignment-due-date"]');

        console.log(`[Canvas Extractor] Assignment detail elements - title:`, titleElement, 'description:', descriptionElement, 'points:', pointsElement, 'dueDate:', dueDateElement);

        if (titleElement) {
            const result = {
                title: titleElement.textContent.trim(),
                url: window.location.href,
                dueDate: dueDateElement ? this.parseDueDate(dueDateElement.textContent.trim()) : null,
                points: pointsElement ? this.parsePoints(pointsElement.textContent.trim()) : null,
                type: this.getAssignmentTypeFromPage(),
                description: descriptionElement ? descriptionElement.textContent.trim().substring(0, 500) : null,
                course: this.getCourseNameFromPage(),
                source: 'assignment_detail'
            };

            console.log(`[Canvas Extractor] Assignment detail result:`, result);
            assignments.push(result);
        }

        return assignments;
    }

    async extractFromCourseHome() {
        console.log(`[Canvas Extractor] Starting course home extraction`);
        const assignments = [];
        
        // Look for assignment widgets or cards on course home
        const assignmentCards = document.querySelectorAll('.course-home-sub-navigation-lti a[href*="assignment"], .card a[href*="assignment"]');
        console.log(`[Canvas Extractor] Found ${assignmentCards.length} assignment cards`);

        assignmentCards.forEach((card, index) => {
            console.log(`[Canvas Extractor] Processing course home card ${index + 1}:`, card);
            const result = {
                title: card.textContent.trim(),
                url: card.href,
                dueDate: null,
                points: null,
                type: 'assignment',
                description: null,
                course: this.getCourseNameFromPage(),
                source: 'course_home'
            };

            console.log(`[Canvas Extractor] Course home card result:`, result);
            assignments.push(result);
        });

        return assignments;
    }

    extractFromAssignmentList() {
        console.log(`[Canvas Extractor] Starting assignment list extraction`);
        const assignments = [];
        
        // First, try the fallback approach that works - use ALL assignment links
        console.log(`[Canvas Extractor] Performing broad assignment search for assignments list`);
        const allAssignmentLinks = document.querySelectorAll('a[href*="/assignments/"]');
        console.log(`[Canvas Extractor] Found ${allAssignmentLinks.length} assignment links on assignments page`);
        
        // If we find assignment links, extract them even if they don't match specific selectors
        if (allAssignmentLinks.length > 0) {
            console.log(`[Canvas Extractor] Processing all assignment links as fallback on assignments page`);
            allAssignmentLinks.forEach((link, index) => {
                console.log(`[Canvas Extractor] Processing assignment link ${index + 1}:`, link);
                
                // Skip if it's not actually an assignment detail link
                if (!link.href.match(/\/assignments\/\d+/)) {
                    console.log(`[Canvas Extractor] Skipping non-assignment link: ${link.href}`);
                    return;
                }
                
                // Find the parent container to extract additional info
                const parentElement = link.closest('tr, li, .assignment, .ig-row, [class*="assignment"], [class*="item"]');
                console.log(`[Canvas Extractor] Parent element for assignment link:`, parentElement);
                
                // Try to extract due date and points from parent
                let dueDate = null;
                let points = null;
                
                if (parentElement) {
                    const dueDateElement = parentElement.querySelector('.due-date, [class*="due"], .date, [class*="date"]');
                    const pointsElement = parentElement.querySelector('.points, [class*="points"], [class*="pts"]');
                    
                    if (dueDateElement) {
                        dueDate = this.parseDueDate(dueDateElement.textContent.trim());
                    }
                    if (pointsElement) {
                        points = this.parsePoints(pointsElement.textContent.trim());
                    }
                    
                    console.log(`[Canvas Extractor] Extracted from parent - dueDate:`, dueDate, 'points:', points);
                }
                
                const result = {
                    title: link.textContent.trim(),
                    url: link.href,
                    dueDate: dueDate,
                    points: points,
                    type: 'assignment',
                    description: null,
                    course: this.getCourseNameFromPage(),
                    source: 'assignments_list_fallback'
                };
                
                console.log(`[Canvas Extractor] Assignment list fallback result:`, result);
                assignments.push(result);
            });
            
            // If we got assignments from fallback, return them
            if (assignments.length > 0) {
                console.log(`[Canvas Extractor] Successfully extracted ${assignments.length} assignments using fallback method`);
                return assignments;
            }
        }
        
        // Original method as secondary approach
        console.log(`[Canvas Extractor] Trying original assignment list selectors`);
        const assignmentRows = document.querySelectorAll('.assignment-list .ig-row, [data-testid="assignment-row"]');
        console.log(`[Canvas Extractor] Found ${assignmentRows.length} assignment rows with original selectors`);

        assignmentRows.forEach((row, index) => {
            console.log(`[Canvas Extractor] Processing assignment row ${index + 1}:`, row);
            const titleElement = row.querySelector('.ig-title a, .assignment-title a, [data-testid="assignment-link"]');
            const dueDateElement = row.querySelector('.assignment-date-due, .ig-details .date_text, [data-testid="assignment-due-date"]');
            const pointsElement = row.querySelector('.assignment-points-possible, .ig-details .points, [data-testid="assignment-points"]');
            
            console.log(`[Canvas Extractor] Assignment row elements - title:`, titleElement, 'dueDate:', dueDateElement, 'points:', pointsElement);

            if (titleElement) {
                const result = {
                    title: titleElement.textContent.trim(),
                    url: titleElement.href,
                    dueDate: dueDateElement ? this.parseDueDate(dueDateElement.textContent.trim()) : null,
                    points: pointsElement ? this.parsePoints(pointsElement.textContent.trim()) : null,
                    type: this.getAssignmentType(row),
                    description: null,
                    course: this.getCourseNameFromPage(),
                    source: 'assignments_list'
                };

                console.log(`[Canvas Extractor] Assignment row result:`, result);
                assignments.push(result);
            }
        });

        console.log(`[Canvas Extractor] Assignment list extraction complete. Found ${assignments.length} assignments`);
        return assignments;
    }

    extractFromModules() {
        console.log(`[Canvas Extractor] Starting modules extraction`);
        const assignments = [];
        
        // Canvas modules view
        const moduleItems = document.querySelectorAll('.context_module_item[data-module-item-type="Assignment"]');
        console.log(`[Canvas Extractor] Found ${moduleItems.length} module items`);

        moduleItems.forEach((item, index) => {
            console.log(`[Canvas Extractor] Processing module item ${index + 1}:`, item);
            const titleElement = item.querySelector('.ig-title a, .item_name a');
            const dueDateElement = item.querySelector('.due_date_display');
            
            console.log(`[Canvas Extractor] Module item elements - title:`, titleElement, 'dueDate:', dueDateElement);

            if (titleElement) {
                const result = {
                    title: titleElement.textContent.trim(),
                    url: titleElement.href,
                    dueDate: dueDateElement ? this.parseDueDate(dueDateElement.textContent.trim()) : null,
                    points: null,
                    type: 'assignment',
                    description: null,
                    course: this.getCourseNameFromPage(),
                    source: 'modules'
                };

                console.log(`[Canvas Extractor] Module item result:`, result);
                assignments.push(result);
            }
        });

        return assignments; // Always return array, not null
    }

    extractFromSyllabus() {
        console.log(`[Canvas Extractor] Starting syllabus extraction`);
        const assignments = [];
        
        // Syllabus view
        const syllabusItems = document.querySelectorAll('.syllabus_assignment');
        console.log(`[Canvas Extractor] Found ${syllabusItems.length} syllabus items`);

        syllabusItems.forEach((item, index) => {
            console.log(`[Canvas Extractor] Processing syllabus item ${index + 1}:`, item);
            const titleElement = item.querySelector('.assignment_title a');
            const dueDateElement = item.querySelector('.syllabus_assignment_date');
            
            console.log(`[Canvas Extractor] Syllabus item elements - title:`, titleElement, 'dueDate:', dueDateElement);

            if (titleElement) {
                const result = {
                    title: titleElement.textContent.trim(),
                    url: titleElement.href,
                    dueDate: dueDateElement ? this.parseDueDate(dueDateElement.textContent.trim()) : null,
                    points: null,
                    type: 'assignment',
                    description: null,
                    course: this.getCourseNameFromPage(),
                    source: 'syllabus'
                };

                console.log(`[Canvas Extractor] Syllabus item result:`, result);
                assignments.push(result);
            }
        });

        return assignments; // Always return array, not null
    }

    async extractFromAPI() {
        console.log(`[Canvas Extractor] Starting API extraction`);
        try {
            // Try to get course ID from URL
            const courseMatch = window.location.pathname.match(/\/courses\/(\d+)/);
            if (!courseMatch) {
                console.log(`[Canvas Extractor] No course ID found in URL`);
                return [];
            }

            const courseId = courseMatch[1];
            console.log(`[Canvas Extractor] Extracting assignments for course ID: ${courseId}`);
            
            // This would require Canvas API token - for now return empty array
            // In a real implementation, you'd need the user to provide their Canvas API token
            console.log('[Canvas Extractor] API extraction not implemented yet - requires Canvas API token');
            return [];
            
        } catch (error) {
            console.error('[Canvas Extractor] API extraction failed:', error);
            return [];
        }
    }

    getAssignmentType(element) {
        console.log(`[Canvas Extractor] Determining assignment type for element:`, element);
        const iconElement = element.querySelector('.icon-assignment, .icon-quiz, .icon-discussion');
        
        if (iconElement) {
            if (iconElement.classList.contains('icon-quiz')) {
                console.log(`[Canvas Extractor] Detected type: quiz`);
                return 'quiz';
            }
            if (iconElement.classList.contains('icon-discussion')) {
                console.log(`[Canvas Extractor] Detected type: discussion`);
                return 'discussion';
            }
            console.log(`[Canvas Extractor] Detected type: assignment`);
            return 'assignment';
        }
        
        console.log(`[Canvas Extractor] Default type: assignment`);
        return 'assignment';
    }

    parseDueDate(dateText) {
        console.log(`[Canvas Extractor] Parsing due date from text: "${dateText}"`);
        if (!dateText || dateText.toLowerCase().includes('no due date')) {
            console.log(`[Canvas Extractor] No due date found`);
            return null;
        }
        
        // Clean up the date text
        let cleaned = dateText.replace(/^due\s+/i, '').trim();
        cleaned = cleaned.replace(/\s+at\s+\d+:\d+[ap]m/i, ''); // Remove time portion
        cleaned = cleaned.replace(/\s+\d+:\d+[ap]m/i, ''); // Remove time portion
        cleaned = cleaned.replace(/^\w+,?\s*/, ''); // Remove day of week
        
        console.log(`[Canvas Extractor] Cleaned date text: "${cleaned}"`);
        
        // Handle incomplete dates like "/13", "/28" by returning null
        if (cleaned.match(/^\/\d{1,2}$/)) {
            console.log(`[Canvas Extractor] Incomplete date format detected: "${cleaned}", returning null`);
            return null;
        }
        
        // Handle obviously incorrect years (like 2001 when it's 2025)
        if (cleaned.includes('2001') || cleaned.includes('1999') || cleaned.includes('2000')) {
            console.log(`[Canvas Extractor] Invalid year detected: "${cleaned}", returning null`);
            return null;
        }
        
        // Try different date parsing approaches
        const currentYear = new Date().getFullYear();
        const dateFormats = [
            // Direct parsing
            () => new Date(cleaned),
            // Try with current year if year is missing
            () => new Date(`${cleaned}, ${currentYear}`),
            // Try month/day format with current year
            () => {
                const match = cleaned.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
                if (match) {
                    const year = match[3] || currentYear;
                    // Validate year is reasonable (between current year and next year)
                    if (year >= currentYear && year <= currentYear + 1) {
                        return new Date(`${match[1]}/${match[2]}/${year}`);
                    }
                }
                return null;
            },
            // Try text format like "Sep 15" or "September 15"
            () => {
                const match = cleaned.match(/([A-Za-z]{3,9})\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
                if (match) {
                    const year = match[3] || currentYear;
                    // Validate year is reasonable
                    if (year >= currentYear && year <= currentYear + 1) {
                        return new Date(`${match[1]} ${match[2]}, ${year}`);
                    }
                }
                return null;
            },
            // Try ISO format
            () => {
                if (cleaned.match(/^\d{4}-\d{2}-\d{2}/)) {
                    return new Date(cleaned);
                }
                return null;
            }
        ];
        
        for (const formatFn of dateFormats) {
            try {
                const date = formatFn();
                if (date && !isNaN(date.getTime())) {
                    // Validate the date is not in the past by more than a year
                    const now = new Date();
                    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                    const twoYearsFromNow = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
                    
                    if (date >= oneYearAgo && date <= twoYearsFromNow) {
                        const formattedDate = date.toLocaleDateString();
                        console.log(`[Canvas Extractor] Successfully parsed date: "${formattedDate}"`);
                        return formattedDate;
                    } else {
                        console.log(`[Canvas Extractor] Date outside reasonable range: ${date}`);
                    }
                }
            } catch (e) {
                console.log(`[Canvas Extractor] Date parsing error:`, e);
                // Continue to next format
            }
        }

        console.log(`[Canvas Extractor] Unable to parse date, returning null for: "${cleaned}"`);
        return null; // Return null instead of raw text for invalid dates
    }

    parsePoints(pointsText) {
        console.log(`[Canvas Extractor] Parsing points from text: "${pointsText}"`);
        const match = pointsText.match(/(\d+(?:\.\d+)?)/);
        const points = match ? parseFloat(match[1]) : null;
        console.log(`[Canvas Extractor] Parsed points:`, points);
        return points;
    }

    waitForElement(selector, timeout = 5000) {
        console.log(`[Canvas Extractor] Waiting for element with selector: "${selector}"`);
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                console.log(`[Canvas Extractor] Element found immediately:`, element);
                resolve(element);
                return;
            }

            const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);
                if (element) {
                    console.log(`[Canvas Extractor] Element found via mutation observer:`, element);
                    observer.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                console.log(`[Canvas Extractor] Timeout reached, element not found`);
                observer.disconnect();
                resolve(null); // Don't reject, just resolve with null
            }, timeout);
        });
    }

    deduplicateAssignments(assignments) {
        console.log(`[Canvas Extractor] Deduplicating assignments`);
        const seen = new Set();
        const deduplicated = assignments.filter(assignment => {
            const key = assignment.url || assignment.title;
            if (seen.has(key)) {
                console.log(`[Canvas Extractor] Duplicate found, skipping:`, assignment);
                return false;
            }
            seen.add(key);
            return true;
        });
        console.log(`[Canvas Extractor] Deduplication complete. Original: ${assignments.length}, Deduplicated: ${deduplicated.length}`);
        return deduplicated;
    }

    getCourseNameFromPage() {
        console.log(`[Canvas Extractor] Getting course name from page`);
        
        // Try multiple selectors to find course name
        const courseSelectors = [
            // Modern Canvas selectors
            '#course_name',
            '.course-title',
            '.course-name',
            '[data-testid="course-name"]',
            '.ic-app-header__main-navigation .course-name',
            '.ic-app-nav-toggle-and-crumbs .course-name',
            '.ic-app-crumbs .course-name',
            
            // Breadcrumb and navigation selectors
            '.ic-app-crumbs a[href*="/courses/"]',
            'nav .course-name',
            '.breadcrumbs .course-name',
            '.context-name',
            
            // Header selectors
            'h1.course-title',
            'h1 .course-title',
            '.course-header .course-title',
            '.page-title .course-name',
            
            // Fallback selectors
            '[class*="course-title"]',
            '[class*="course-name"]'
        ];
        
        for (const selector of courseSelectors) {
            const courseElement = document.querySelector(selector);
            if (courseElement && courseElement.textContent.trim()) {
                const courseText = courseElement.textContent.trim();
                console.log(`[Canvas Extractor] Found course element with selector "${selector}": "${courseText}"`);
                
                // Validate it's actually a course name (not GPA, grade info, etc.)
                if (!courseText.includes('GPA') && 
                    !courseText.includes('Cumulative') && 
                    !courseText.includes('Grade') &&
                    !courseText.match(/^\d+\.\d+$/) && // Not a decimal number
                    courseText.length > 2) {
                    
                    console.log(`[Canvas Extractor] Using course name: "${courseText}"`);
                    return courseText;
                }
            }
        }
        
        // Try to extract from page title
        const pageTitle = document.title;
        if (pageTitle && !pageTitle.includes('Canvas')) {
            // Look for course patterns in title like "Course Name - Canvas" or "CPT S 484: Course Name"
            const titleMatch = pageTitle.match(/^([^-]+(?:CPT[_\s]S?\s*\d+[^-]*|[A-Z]{2,8}\s*\d{3}[^-]*|[^-]+))/i);
            if (titleMatch) {
                const courseFromTitle = titleMatch[1].trim();
                if (courseFromTitle.length > 3 && !courseFromTitle.toLowerCase().includes('canvas')) {
                    console.log(`[Canvas Extractor] Found course in page title: "${courseFromTitle}"`);
                    return courseFromTitle;
                }
            }
        }
        
        // Try to extract from URL
        const urlMatch = window.location.pathname.match(/\/courses\/(\d+)/);
        if (urlMatch) {
            const courseId = urlMatch[1];
            console.log(`[Canvas Extractor] Found course ID: ${courseId}, using as fallback`);
            return `Course ${courseId}`;
        }
        
        console.log(`[Canvas Extractor] Could not determine course name, using default`);
        return 'Unknown Course';
    }

    getAssignmentTypeFromPage() {
        console.log(`[Canvas Extractor] Determining assignment type from page`);
        const path = window.location.pathname;
        if (path.includes('quiz')) {
            console.log(`[Canvas Extractor] Detected type: quiz`);
            return 'quiz';
        }
        if (path.includes('discussion')) {
            console.log(`[Canvas Extractor] Detected type: discussion`);
            return 'discussion';
        }
        console.log(`[Canvas Extractor] Default type: assignment`);
        return 'assignment';
    }
}

// Initialize the extractor
new CanvasAssignmentExtractor();