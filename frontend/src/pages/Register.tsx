import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ROLE_LABELS } from "../config/roles";
import { api } from "../services/api";
import axios from "axios";
import type { UserRole } from "../types";

export function RegisterPage() {
  const currentYear = new Date().getFullYear();
  const [step, setStep] = useState(1);
  const [tenants, setTenants] = useState<
    { id: string; name: string; domain: string }[]
  >([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [courses, setCourses] = useState<
    { id: string; name: string; code: string; durationYears: number }[]
  >([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [collegeEmailSuffix, setCollegeEmailSuffix] = useState("");
  const [emailPrefix, setEmailPrefix] = useState("");
  const [formData, setFormData] = useState({
    // Step 1: Account
    fullName: "",
    username: "",
    email: "",
    personalEmail: "",
    collegeEmail: "",
    phone: "",
    password: "",
    confirmPassword: "",
    // Step 2: Role
    role: "student" as UserRole,
    // Step 3: Profile (for students)
    tenantId: "",
    courseId: "",
    courseDuration: 4,
    year: "",
    batchStartYear: currentYear,
    batchEndYear: currentYear + 4,
    branchId: "",
    enrollmentNumber: "",
    // Step 4: Consent
    agreedToTerms: false,
    agreedToPrivacy: false,
    agreedToMonitoring: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors] = useState<Record<string, string>>({});

  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [usernameError, setUsernameError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Email validation state
  const [emailStatus, setEmailStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [emailError, setEmailError] = useState("");

  // Enrollment number validation state
  const [enrollmentStatus, setEnrollmentStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [enrollmentError, setEnrollmentError] = useState("");

  // Modal states for Terms and Privacy Policy
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [termsScrollAgreed, setTermsScrollAgreed] = useState(false);
  const [privacyScrollAgreed, setPrivacyScrollAgreed] = useState(false);

  const navigate = useNavigate();

  // Password validation criteria
  const passwordCriteria = useMemo(() => {
    const pwd = formData.password;
    return {
      length: pwd.length >= 8,
      lowercase: /[a-z]/.test(pwd),
      uppercase: /[A-Z]/.test(pwd),
      number: /\d/.test(pwd),
      special: /[@$!%*?&]/.test(pwd),
    };
  }, [formData.password]);

  const isPasswordValid = useMemo(() => {
    return (
      passwordCriteria.length &&
      passwordCriteria.lowercase &&
      passwordCriteria.uppercase &&
      passwordCriteria.number &&
      passwordCriteria.special
    );
  }, [passwordCriteria]);

  const passwordsMatch = useMemo(() => {
    return (
      formData.password === formData.confirmPassword &&
      formData.confirmPassword.length > 0
    );
  }, [formData.password, formData.confirmPassword]);

  // Password strength checker
  const passwordStrength = useMemo(() => {
    const pwd = formData.password;
    if (!pwd) return { score: 0, label: "", color: "" };

    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[@$!%*?&]/.test(pwd)) score++;

    const levels = [
      { label: "Very Weak", color: "bg-red-500" },
      { label: "Weak", color: "bg-red-400" },
      { label: "Fair", color: "bg-yellow-500" },
      { label: "Good", color: "bg-green-400" },
      { label: "Strong", color: "bg-green-500" },
    ];

    return { score, ...levels[Math.min(score, 4)] };
  }, [formData.password]);

  // Username validation with debounce
  const validateUsername = useCallback(async (username: string) => {
    if (!username) {
      setUsernameStatus("idle");
      setUsernameError("");
      return;
    }

    // Basic format validation - minimum 8 characters
    if (username.length < 8) {
      setUsernameStatus("invalid");
      setUsernameError("Username must be at least 8 characters");
      return;
    }
    if (username.length > 20) {
      setUsernameStatus("invalid");
      setUsernameError("Username must be at most 20 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameStatus("invalid");
      setUsernameError(
        "Username can only contain letters, numbers, and underscores",
      );
      return;
    }
    if (!/^[a-zA-Z]/.test(username)) {
      setUsernameStatus("invalid");
      setUsernameError("Username must start with a letter");
      return;
    }

    setUsernameStatus("checking");
    setUsernameError("");

    try {
      const result = await api.checkUsernameAvailability(
        username.toLowerCase(),
      );
      if (result.available) {
        setUsernameStatus("available");
        setUsernameError("");
      } else {
        setUsernameStatus("taken");
        setUsernameError(result.message || "Username is already taken");
      }
    } catch (err: unknown) {
      console.error("Username check error:", err);
      setUsernameStatus("invalid");
      setUsernameError("Failed to check username");
    }
  }, []);

  // Debounce username validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.username) {
        validateUsername(formData.username);
      } else {
        setUsernameStatus("idle");
        setUsernameError("");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.username, validateUsername]);

  // Email validation with debounce
  useEffect(() => {
    if (!formData.collegeEmail || !formData.tenantId) {
      setEmailStatus("idle");
      setEmailError("");
      return;
    }

    // Skip validation if username contains @ (invalid input from user)
    if (emailPrefix.includes("@")) {
      setEmailStatus("invalid");
      setEmailError("Enter username only (without @domain)");
      return;
    }

    const timer = setTimeout(async () => {
      setEmailStatus("checking");
      setEmailError("");

      try {
        const result = await api.checkEmailAvailability(formData.collegeEmail);
        if (result.available) {
          setEmailStatus("available");
          setEmailError("");
        } else {
          setEmailStatus("taken");
          setEmailError(result.message || "Email already registered");
        }
      } catch (err: unknown) {
        console.error("Email check error:", err);
        setEmailStatus("invalid");
        setEmailError("Failed to validate email");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.collegeEmail, formData.tenantId]);

  // Enrollment number validation with debounce
  useEffect(() => {
    if (
      !formData.enrollmentNumber ||
      !formData.courseId ||
      !formData.tenantId
    ) {
      setEnrollmentStatus("idle");
      setEnrollmentError("");
      return;
    }

    const timer = setTimeout(async () => {
      setEnrollmentStatus("checking");
      setEnrollmentError("");

      try {
        const result = await api.checkEnrollmentNumberAvailability(
          formData.enrollmentNumber,
          formData.courseId,
          formData.tenantId,
        );
        if (result.available) {
          setEnrollmentStatus("available");
          setEnrollmentError("");
        } else {
          setEnrollmentStatus("taken");
          setEnrollmentError(
            result.message || "Enrollment number already registered",
          );
        }
      } catch (err: unknown) {
        console.error("Enrollment check error:", err);
        setEnrollmentStatus("invalid");
        setEnrollmentError("Failed to validate enrollment number");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.enrollmentNumber, formData.courseId, formData.tenantId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tenants = await api.getPublicTenants();
        if (tenants.length === 0) {
          window.location.href = "/setup";
          return;
        }
        setTenants(tenants);
      } catch (err: unknown) {
        console.error("Failed to fetch colleges:", err);
        // Check if system needs setup
        if (
          err instanceof Error && axios.isAxiosError(err) && (err.response?.status === 400 ||
          err.response?.data?.error?.includes("not initialized"))
        ) {
          window.location.href = "/setup";
          return;
        }
        setError("Failed to load college list. Please refresh.");
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (formData.tenantId) {
      // Fetch branches for selected college
      api
        .getPublicBranches(formData.tenantId)
        .then(setBranches)
        .catch((err) => console.error("Failed to fetch branches:", err));

      // Fetch courses for selected college
      api
        .getPublicCourses(formData.tenantId)
        .then(setCourses)
        .catch((err) => console.error("Failed to fetch courses:", err));

      // Set college email suffix
      const college = tenants.find((t) => t.id === formData.tenantId);
      if (college?.domain) {
        setCollegeEmailSuffix("@" + college.domain);
      }
      // Reset email prefix when college changes
      setEmailPrefix("");
    } else {
      setBranches([]);
      setCourses([]);
      setCollegeEmailSuffix("");
      setEmailPrefix("");
    }
  }, [formData.tenantId]);

  // Generate year options based on course duration
  const yearOptions = useMemo(() => {
    const options = [];
    for (let i = 1; i <= formData.courseDuration; i++) {
      options.push({
        value: i.toString(),
        label: `${i}${getOrdinalSuffix(i)} Year`,
      });
    }
    return options;
  }, [formData.courseDuration]);

  // Generate batch end years (future years only, based on course duration)
  const batchEndYears = useMemo(() => {
    const years = [];
    for (let y = currentYear - 4; y <= currentYear + 11; y++) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  function getOrdinalSuffix(n: number): string {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  // Handle course selection to update duration and batch
  const handleCourseChange = (courseId: string) => {
    const selectedCourse = courses.find((c) => c.id === courseId);
    const duration = selectedCourse?.durationYears || 4;

    if (!courseId) {
      setFormData({
        ...formData,
        courseId: "",
        courseDuration: 4,
        year: "",
        branchId: "",
        enrollmentNumber: "",
        batchStartYear: currentYear,
        batchEndYear: currentYear + 4,
      });
      setEmailPrefix("");
      setEmailStatus("idle");
      setEmailError("");
      return;
    }

    setFormData({
      ...formData,
      courseId,
      courseDuration: duration,
      year: "",
      branchId: "",
      enrollmentNumber: "",
      batchStartYear: formData.batchEndYear - duration,
      batchEndYear: currentYear + duration,
    });
    setEmailPrefix("");
    setEmailStatus("idle");
    setEmailError("");
  };

  // Handle batch end year change - auto-calculate start year
  const handleBatchEndYearChange = (endYear: number) => {
    setFormData({
      ...formData,
      batchEndYear: endYear,
      batchStartYear: endYear - formData.courseDuration,
    });
  };

  const roles: { value: UserRole; label: string; description: string }[] = [
    {
      value: "student",
      label: ROLE_LABELS.student,
      description: "Track your coding progress and build your profile",
    },
    {
      value: "teacher",
      label: ROLE_LABELS.teacher,
      description: "Monitor and guide students in your branch",
    },
    {
      value: "coordinator",
      label: ROLE_LABELS.coordinator,
      description: "Manage a department branch and its teachers",
    },
    {
      value: "college_head",
      label: ROLE_LABELS.college_head,
      description: "Administer your entire college on the platform",
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!formData.tenantId) {
      setError("Please select your college");
      return;
    }

    if (!formData.collegeEmail) {
      setError("Please enter your college email");
      return;
    }

    if (emailStatus === "taken" || emailStatus === "invalid") {
      setError("Please enter a valid email address");
      return;
    }

    if (formData.role === "student") {
      if (!formData.courseId) {
        setError("Please select your course");
        return;
      }
      if (!formData.branchId) {
        setError("Please select your department/branch");
        return;
      }
      if (!formData.year) {
        setError("Please select your current year");
        return;
      }
      if (!formData.enrollmentNumber) {
        setError("Please enter your enrollment number");
        return;
      }
    }

    // Validate phone number if provided
    if (formData.phone && formData.phone !== "+91 ") {
      const phoneRegex = /^\+91 \d{5} ?\d{0,5}$/;
      if (!phoneRegex.test(formData.phone)) {
        setError("Please enter a valid phone number (e.g., +91 98765 43210)");
        return;
      }
    }

    if (!formData.agreedToTerms || !formData.agreedToPrivacy) {
      setError("Please accept the terms and privacy policy");
      return;
    }

    setLoading(true);

    try {
      await api.register({
        fullName: formData.fullName,
        username: formData.username,
        email: formData.collegeEmail,
        personalEmail: formData.personalEmail || undefined,
        collegeEmail: formData.collegeEmail,
        password: formData.password,
        tenantId: formData.tenantId,
        roleName: formData.role,
        branchId: formData.branchId || undefined,
        courseId: formData.courseId || undefined,
        phone: formData.phone || undefined,
        enrollmentNumber: formData.enrollmentNumber || undefined,
        academicYearId: formData.year || undefined,
      });
      navigate("/dashboard");
    } catch (err: unknown) {
      const backendError = err instanceof Error ? (axios.isAxiosError(err) ? err.response?.data?.error : undefined) : undefined;
      if (Array.isArray(backendError)) {
        setError(
          backendError
            .map((e: { message?: string }) => e.message || "Validation error")
            .join(", "),
        );
      } else {
        setError(backendError || "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    // Step 1 validation - check password criteria before proceeding
    if (step === 1) {
      if (!formData.fullName || formData.fullName.length < 2) {
        setError("Please enter your full name");
        return;
      }
      if (!formData.username || formData.username.length < 8) {
        setError("Please enter a username (minimum 8 characters)");
        return;
      }
      if (usernameStatus === "taken" || usernameStatus === "invalid") {
        setError("Please enter a valid username");
        return;
      }
      if (!formData.personalEmail) {
        setError("Please enter your personal email");
        return;
      }
      if (!isPasswordValid) {
        setError("Please meet all password requirements");
        return;
      }
      if (!passwordsMatch) {
        setError("Passwords do not match");
        return;
      }

      // Phone validation (optional but if provided must be valid)
      if (formData.phone) {
        const phoneDigits = formData.phone.replace(/\D/g, "");
        if (phoneDigits.length < 10) {
          setError(
            "Please enter a valid 10-digit phone number (e.g., +91 98765 43210)",
          );
          return;
        }
      }
    }

    // Step 3 validation - role-specific
    if (step === 3) {
      if (!formData.tenantId) {
        setError("Please select your college");
        return;
      }

      // Student needs: college email, course, branch, year, enrollment
      if (formData.role === "student") {
        if (!formData.collegeEmail) {
          setError("Please enter your college email");
          return;
        }
        if (!formData.courseId) {
          setError("Please select your course");
          return;
        }
        if (!formData.branchId) {
          setError("Please select your department/branch");
          return;
        }
        if (!formData.year) {
          setError("Please select your current year");
          return;
        }
        if (!formData.enrollmentNumber) {
          setError("Please enter your enrollment number");
          return;
        }
        if (enrollmentStatus === "taken" || enrollmentStatus === "invalid") {
          setError("Please enter a valid enrollment number");
          return;
        }
      }

      // Coordinator needs: college email after branch
      if (formData.role === "coordinator") {
        if (!formData.branchId) {
          setError("Please select your department/branch");
          return;
        }
        if (!formData.collegeEmail) {
          setError("Please enter your college email");
          return;
        }
      }

      // Teacher needs: college email after branch
      if (formData.role === "teacher") {
        if (!formData.branchId) {
          setError("Please select your department/branch");
          return;
        }
        if (!formData.collegeEmail) {
          setError("Please enter your college email");
          return;
        }
      }

      // College Head needs: college email (no branch needed)
      if (formData.role === "college_head") {
        if (!formData.collegeEmail) {
          setError("Please enter your college email");
          return;
        }
      }

      // Check email status (if college email was required)
      if (
        formData.collegeEmail &&
        (emailStatus === "taken" || emailStatus === "invalid")
      ) {
        setError("Please enter a valid email address");
        return;
      }

      // Continue to next step
    }

    setError("");
    setStep(step + 1);
  };
  const prevStep = () => setStep(step - 1);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black py-8 px-4 sm:px-6 lg:px-8">
      <div className="card-container p-8 w-full max-w-lg relative overflow-hidden">
        {/* Decorative accent lines */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--accent-green)] via-[var(--accent-yellow)] to-[var(--accent-red)]"></div>
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                s <= step
                  ? "bg-[var(--accent-green)] shadow-[0_0_8px_var(--accent-green)] scale-110"
                  : "bg-gray-700"
              }`}
            />
          ))}
        </div>

        <h1 className="text-3xl font-black text-white mb-2 text-center tracking-tight">
          Join Talent
          <span className="text-[var(--accent-yellow)] text-glow-yellow">
            OS
          </span>
        </h1>
        <p className="text-gray-400 text-center mb-8 text-sm uppercase tracking-wider font-bold">
          {step === 1 && "Create your account"}
          {step === 2 && "Select your role"}
          {step === 3 && "Tell us about yourself"}
          {step === 4 && "Review privacy & terms"}
        </p>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-500/10 border-l-4 border-[var(--accent-red)] text-[var(--accent-red)] p-4 rounded text-sm font-medium">
              {error}
            </div>
          )}

          {/* Step 1: Account */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-gray-400 mb-2 text-sm font-medium uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className="w-full bg-black/50 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-[var(--accent-green)] focus:ring-1 focus:ring-[var(--accent-green)] transition-all"
                  required
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-2 text-sm font-medium uppercase tracking-wider">
                  Username <span className="text-[var(--accent-red)]">*</span>{" "}
                  <span className="text-gray-500 text-xs normal-case">
                    (minimum 8 characters)
                  </span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                    <span className="text-gray-500 font-medium">@</span>
                  </div>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        username: e.target.value
                          .toLowerCase()
                          .replace(/[^a-zA-Z0-9_]/g, ""),
                      })
                    }
                    className={`w-full bg-black/50 border ${usernameStatus === "taken" || usernameStatus === "invalid" ? "border-red-500" : usernameStatus === "available" ? "border-green-500" : "border-gray-700"} text-white px-4 py-3 pl-8 rounded-lg focus:outline-none focus:border-[var(--accent-yellow)] focus:ring-1 focus:ring-[var(--accent-yellow)] transition-all`}
                    placeholder="your_username"
                    required
                  />
                  {usernameStatus === "checking" && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  {usernameStatus === "available" && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                  {usernameStatus === "taken" && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                {usernameError && (
                  <p className="text-red-400 text-xs mt-1">{usernameError}</p>
                )}
                {usernameStatus === "available" && (
                  <p className="text-green-400 text-xs mt-1">
                    @{formData.username} is available!
                  </p>
                )}
                {usernameStatus !== "taken" &&
                  usernameStatus !== "available" &&
                  !usernameError && (
                    <p className="text-gray-500 text-xs mt-1">
                      Minimum 8 characters. Use this to create a public profile
                      link (e.g., talentos.com/u/yourname)
                    </p>
                  )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="relative">
                  <label className="block text-gray-400 mb-2 text-sm font-medium uppercase tracking-wider">
                    Personal Email{" "}
                    <span className="text-[var(--accent-red)]">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.personalEmail}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        personalEmail: e.target.value,
                      })
                    }
                    className="w-full bg-black/50 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-[var(--accent-green)] focus:ring-1 focus:ring-[var(--accent-green)] transition-all"
                    placeholder="your.personal@email.com"
                    required
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    This email will be used for login
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-2 text-sm font-medium uppercase tracking-wider">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Get all digits
                    let digits = val.replace(/\D/g, "");

                    // Handle the +91 prefix properly
                    // If the input starts with +91, the first two digits are the prefix
                    if (val.startsWith("+91") && digits.startsWith("91")) {
                      digits = digits.slice(2);
                    } else if (digits.length > 10 && digits.startsWith("91")) {
                      // If they pasted a number starting with 91
                      digits = digits.slice(2);
                    }

                    const clean = digits.slice(0, 10);

                    if (clean.length === 0) {
                      // Allow user to clear or edit the prefix manually if they want
                      if (
                        val === "+" ||
                        val === "+9" ||
                        val === "+91" ||
                        val === "+91 "
                      ) {
                        setFormData({ ...formData, phone: val });
                      } else {
                        setFormData({ ...formData, phone: "" });
                      }
                      return;
                    }

                    // Format as +91 XXXXX XXXXX
                    let formatted = "+91 " + clean.slice(0, 5);
                    if (clean.length > 5) {
                      formatted += " " + clean.slice(5);
                    }

                    setFormData({ ...formData, phone: formatted });
                  }}
                  onFocus={() => {
                    if (formData.phone === "") {
                      setFormData({ ...formData, phone: "+91 " });
                    }
                  }}
                  className="w-full bg-black/50 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-[var(--accent-green)] focus:ring-1 focus:ring-[var(--accent-green)] transition-all"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 mb-2 text-sm font-medium uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className={`w-full bg-black/50 border ${fieldErrors.password ? "border-red-500" : "border-gray-700"} text-white px-4 py-3 pr-12 rounded-lg focus:outline-none focus:border-[var(--accent-yellow)] focus:ring-1 focus:ring-[var(--accent-yellow)] transition-all`}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showPassword ? (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                  {formData.password && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded ${level <= passwordStrength.score ? passwordStrength.color : "bg-gray-700"}`}
                          />
                        ))}
                      </div>
                      <div className="space-y-1">
                        <p
                          className={`text-xs ${passwordCriteria.length ? "text-green-400" : "text-red-400"}`}
                        >
                          {passwordCriteria.length ? "✓" : "✗"} At least 8
                          characters
                        </p>
                        <p
                          className={`text-xs ${passwordCriteria.lowercase ? "text-green-400" : "text-red-400"}`}
                        >
                          {passwordCriteria.lowercase ? "✓" : "✗"} Lowercase
                          letter
                        </p>
                        <p
                          className={`text-xs ${passwordCriteria.uppercase ? "text-green-400" : "text-red-400"}`}
                        >
                          {passwordCriteria.uppercase ? "✓" : "✗"} Uppercase
                          letter
                        </p>
                        <p
                          className={`text-xs ${passwordCriteria.number ? "text-green-400" : "text-red-400"}`}
                        >
                          {passwordCriteria.number ? "✓" : "✗"} Number
                        </p>
                        <p
                          className={`text-xs ${passwordCriteria.special ? "text-green-400" : "text-red-400"}`}
                        >
                          {passwordCriteria.special ? "✓" : "✗"} Special
                          character (@$!%*?&)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-gray-400 mb-2 text-sm font-medium uppercase tracking-wider">
                    Confirm
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          confirmPassword: e.target.value,
                        })
                      }
                      className={`w-full bg-black/50 border ${formData.confirmPassword && !passwordsMatch ? "border-red-500" : "border-gray-700"} text-white px-4 py-3 pr-12 rounded-lg focus:outline-none focus:border-[var(--accent-yellow)] focus:ring-1 focus:ring-[var(--accent-yellow)] transition-all`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showConfirmPassword ? (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                  {formData.confirmPassword && (
                    <p
                      className={`text-xs mt-2 ${passwordsMatch ? "text-green-400" : "text-red-400"}`}
                    >
                      {passwordsMatch
                        ? "✓ Passwords match"
                        : "✗ Passwords do not match"}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={nextStep}
                disabled={
                  !formData.fullName ||
                  !formData.username ||
                  !formData.personalEmail ||
                  formData.username.length < 8 ||
                  !isPasswordValid ||
                  !passwordsMatch
                }
                className="btn-green w-full py-3 text-sm uppercase tracking-wider font-bold mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue Pipeline &rarr;
              </button>
            </>
          )}

          {/* Step 2: Role Selection */}
          {step === 2 && (
            <>
              <div className="space-y-3">
                {roles.map((role) => (
                  <label
                    key={role.value}
                    className={`block p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                      formData.role === role.value
                        ? "border-[var(--accent-green)] bg-gradient-to-r from-[var(--accent-green)]/10 to-transparent"
                        : "border-white/5 bg-black/50 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="role"
                        value={role.value}
                        checked={formData.role === role.value}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            role: e.target.value as UserRole,
                          })
                        }
                        className="sr-only"
                      />
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          formData.role === role.value
                            ? "border-[var(--accent-green)]"
                            : "border-gray-500"
                        }`}
                      >
                        {formData.role === role.value && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-green)] shadow-[0_0_5px_var(--accent-green)]" />
                        )}
                      </div>
                      <div>
                        <p
                          className={`font-bold uppercase tracking-wide text-sm ${formData.role === role.value ? "text-[var(--accent-green)] text-glow-green" : "text-white"}`}
                        >
                          {role.label}
                        </p>
                        <p className="text-gray-400 text-xs mt-0.5">
                          {role.description}
                        </p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-medium transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium transition"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {/* Step 3: Profile Details */}
          {step === 3 && (
            <>
              <div className="mb-6">
                <label className="block text-gray-400 mb-2 text-sm font-medium uppercase tracking-wider">
                  Select College
                </label>
                <select
                  value={formData.tenantId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tenantId: e.target.value,
                      branchId: "",
                      courseId: "",
                      year: "",
                    })
                  }
                  className="w-full bg-black/50 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-[var(--accent-green)] focus:ring-1 focus:ring-[var(--accent-green)] transition-all appearance-none"
                  required
                >
                  <option value="" className="bg-gray-900">
                    Select your college
                  </option>
                  {tenants.map((tenant) => (
                    <option
                      key={tenant.id}
                      value={tenant.id}
                      className="bg-gray-900"
                    >
                      {tenant.name}
                    </option>
                  ))}
                </select>
              </div>

              {formData.tenantId && (
                <>
                  {/* Student: Course + Branch + Year + Enrollment */}
                  {formData.role === "student" && (
                    <>
                      <div className="mb-6">
                        <label className="block text-gray-400 mb-2 text-sm font-medium uppercase tracking-wider">
                          Select Course / Program
                        </label>
                        <select
                          value={formData.courseId}
                          onChange={(e) => handleCourseChange(e.target.value)}
                          className="w-full bg-black/50 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-[var(--accent-green)] focus:ring-1 focus:ring-[var(--accent-green)] transition-all appearance-none"
                          required
                        >
                          <option value="" className="bg-gray-900">
                            Select your course
                          </option>
                          {courses.map((course) => (
                            <option
                              key={course.id}
                              value={course.id}
                              className="bg-gray-900"
                            >
                              {course.name} ({course.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="mb-6">
                        <label className="block text-gray-400 mb-2 text-sm font-medium uppercase tracking-wider">
                          Department / Branch
                        </label>
                        <select
                          value={formData.branchId}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              branchId: e.target.value,
                            })
                          }
                          className="w-full bg-black/50 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-[var(--accent-green)] focus:ring-1 focus:ring-[var(--accent-green)] transition-all appearance-none"
                          required
                        >
                          <option value="" className="bg-gray-900">
                            Select your branch
                          </option>
                          {branches.map((branch) => (
                            <option
                              key={branch.id}
                              value={branch.id}
                              className="bg-gray-900"
                            >
                              {branch.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* College Email - Only show after college is selected, after branch */}
                      {collegeEmailSuffix && (
                        <div className="mb-6">
                          <label className="block text-gray-400 mb-2 text-sm font-medium uppercase tracking-wider">
                            College Email{" "}
                            <span className="text-[var(--accent-red)]">*</span>
                          </label>
                          <div className="flex items-center">
                            <input
                              type="text"
                              value={emailPrefix}
                              onChange={(e) => {
                                const prefix = e.target.value;
                                if (prefix.includes("@")) {
                                  setEmailError(
                                    "Enter username only (without @domain)",
                                  );
                                  setEmailStatus("invalid");
                                  return;
                                }
                                setEmailError("");
                                setEmailPrefix(prefix);
                                setFormData({
                                  ...formData,
                                  collegeEmail: prefix + collegeEmailSuffix,
                                });
                                if (prefix.length > 0) {
                                  setEmailStatus("checking");
                                } else {
                                  setEmailStatus("idle");
                                }
                              }}
                              placeholder="Enter your college email"
                              className={`flex-1 bg-black/50 border text-white px-4 py-3 rounded-l-lg focus:outline-none focus:border-[var(--accent-green)] focus:ring-1 focus:ring-[var(--accent-green)] transition-all ${
                                emailStatus === "taken" ||
                                emailStatus === "invalid" ||
                                emailError
                                  ? "border-red-500"
                                  : emailStatus === "available"
                                    ? "border-green-500"
                                    : "border-gray-700"
                              }`}
                              required
                            />
                            <span className="bg-gray-800 text-gray-300 px-3 py-3 rounded-r-lg border border-l-0 border-gray-700 whitespace-nowrap">
                              {collegeEmailSuffix}
                            </span>
                          </div>
                          {emailStatus === "checking" && (
                            <div className="mt-2">
                              <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          )}
                          {emailStatus === "available" && !emailError && (
                            <p className="text-green-400 text-xs mt-1">
                              Email valid!
                            </p>
                          )}
                          {(emailStatus === "taken" || emailError) && (
                            <p className="text-red-400 text-xs mt-1">
                              {emailError || "Email already registered"}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-gray-400 mb-2 text-sm font-medium uppercase tracking-wider">
                              Current Year
                            </label>
                            <select
                              value={formData.year}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  year: e.target.value,
                                })
                              }
                              className="w-full bg-black/50 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-[var(--accent-green)] focus:ring-1 focus:ring-[var(--accent-green)] transition-all appearance-none"
                              required
                            >
                              <option value="" className="bg-gray-900">
                                Select year
                              </option>
                              {yearOptions.map((opt) => (
                                <option
                                  key={opt.value}
                                  value={opt.value}
                                  className="bg-gray-900"
                                >
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-gray-400 mb-2 text-sm font-medium uppercase tracking-wider">
                              Batch (Completing Year)
                            </label>
                            {!formData.courseId ? (
                              <div className="bg-black/50 border border-gray-700 text-gray-400 px-4 py-3 rounded-lg">
                                Select course first
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-white font-bold">
                                  {formData.batchStartYear}
                                </span>
                                <span className="text-gray-400 font-medium">
                                  -
                                </span>
                                <select
                                  value={formData.batchEndYear}
                                  onChange={(e) =>
                                    handleBatchEndYearChange(
                                      parseInt(e.target.value),
                                    )
                                  }
                                  className="w-full bg-black/50 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-[var(--accent-green)] focus:ring-1 focus:ring-[var(--accent-green)] transition-all appearance-none"
                                >
                                  {batchEndYears.map((year) => (
                                    <option
                                      key={year}
                                      value={year}
                                      className="bg-gray-900"
                                    >
                                      {year}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-2 text-sm font-medium uppercase tracking-wider">
                            Enrollment No.{" "}
                            <span className="text-[var(--accent-red)]">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={formData.enrollmentNumber}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  enrollmentNumber:
                                    e.target.value.toUpperCase(),
                                })
                              }
                              className={`w-full bg-black/50 border ${enrollmentStatus === "taken" || enrollmentStatus === "invalid" ? "border-red-500" : enrollmentStatus === "available" ? "border-green-500" : "border-gray-700"} text-white px-4 py-3 rounded-lg focus:outline-none focus:border-[var(--accent-green)] focus:ring-1 focus:ring-[var(--accent-green)] transition-all`}
                              placeholder="e.g., 2315000001"
                              required
                            />
                            {enrollmentStatus === "checking" && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                              </div>
                            )}
                            {enrollmentStatus === "available" && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </div>
                            )}
                            {enrollmentStatus === "taken" && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </div>
                            )}
                          </div>
                          {enrollmentError && (
                            <p className="text-red-400 text-xs mt-1">
                              {enrollmentError}
                            </p>
                          )}
                          {enrollmentStatus === "available" && (
                            <p className="text-green-400 text-xs mt-1">
                              Enrollment number verified!
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Coordinator: Branch only */}
                  {formData.role === "coordinator" && (
                    <div className="mb-6">
                      <label className="block text-gray-400 mb-2 text-sm font-medium uppercase tracking-wider">
                        Department / Branch
                      </label>
                      <select
                        value={formData.branchId}
                        onChange={(e) =>
                          setFormData({ ...formData, branchId: e.target.value })
                        }
                        className="w-full bg-black/50 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-[var(--accent-green)] focus:ring-1 focus:ring-[var(--accent-green)] transition-all appearance-none"
                        required
                      >
                        <option value="" className="bg-gray-900">
                          Select your department
                        </option>
                        {branches.map((branch) => (
                          <option
                            key={branch.id}
                            value={branch.id}
                            className="bg-gray-900"
                          >
                            {branch.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-gray-500 text-xs mt-2">
                        As a coordinator, you'll manage this department/branch
                      </p>
                    </div>
                  )}

                  {/* College Email - Show for coordinator/teacher after branch */}
                  {(formData.role === "coordinator" ||
                    formData.role === "teacher") &&
                    collegeEmailSuffix &&
                    formData.branchId && (
                      <div className="mb-6">
                        <label className="block text-gray-400 mb-2 text-sm font-medium uppercase tracking-wider">
                          College Email{" "}
                          <span className="text-[var(--accent-red)]">*</span>
                        </label>
                        <div className="flex items-center">
                          <input
                            type="text"
                            value={emailPrefix}
                            onChange={(e) => {
                              const prefix = e.target.value;
                              if (prefix.includes("@")) {
                                setEmailError(
                                  "Enter username only (without @domain)",
                                );
                                setEmailStatus("invalid");
                                return;
                              }
                              setEmailError("");
                              setEmailPrefix(prefix);
                              setFormData({
                                ...formData,
                                collegeEmail: prefix + collegeEmailSuffix,
                              });
                              if (prefix.length > 0) {
                                setEmailStatus("checking");
                              } else {
                                setEmailStatus("idle");
                              }
                            }}
                            placeholder="Enter your college email"
                            className={`flex-1 bg-black/50 border text-white px-4 py-3 rounded-l-lg focus:outline-none focus:border-[var(--accent-green)] focus:ring-1 focus:ring-[var(--accent-green)] transition-all ${
                              emailStatus === "taken" ||
                              emailStatus === "invalid" ||
                              emailError
                                ? "border-red-500"
                                : emailStatus === "available"
                                  ? "border-green-500"
                                  : "border-gray-700"
                            }`}
                            required
                          />
                          <span className="bg-gray-800 text-gray-300 px-3 py-3 rounded-r-lg border border-l-0 border-gray-700 whitespace-nowrap">
                            {collegeEmailSuffix}
                          </span>
                        </div>
                        {emailStatus === "checking" && (
                          <div className="mt-2">
                            <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                        {emailStatus === "available" && !emailError && (
                          <p className="text-green-400 text-xs mt-1">
                            Email valid!
                          </p>
                        )}
                        {(emailStatus === "taken" || emailError) && (
                          <p className="text-red-400 text-xs mt-1">
                            {emailError || "Email already registered"}
                          </p>
                        )}
                      </div>
                    )}

                  {/* Teacher: Branch only */}
                  {formData.role === "teacher" && (
                    <div className="mb-6">
                      <label className="block text-gray-400 mb-2 text-sm font-medium uppercase tracking-wider">
                        Department / Branch
                      </label>
                      <select
                        value={formData.branchId}
                        onChange={(e) =>
                          setFormData({ ...formData, branchId: e.target.value })
                        }
                        className="w-full bg-black/50 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-[var(--accent-green)] focus:ring-1 focus:ring-[var(--accent-green)] transition-all appearance-none"
                        required
                      >
                        <option value="" className="bg-gray-900">
                          Select your department
                        </option>
                        {branches.map((branch) => (
                          <option
                            key={branch.id}
                            value={branch.id}
                            className="bg-gray-900"
                          >
                            {branch.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-gray-500 text-xs mt-2">
                        As a teacher, you'll be assigned to this
                        department/branch
                      </p>
                    </div>
                  )}

                  {/* College Email - Show for teacher after branch */}
                  {formData.role === "teacher" &&
                    collegeEmailSuffix &&
                    formData.branchId && (
                      <div className="mb-6">
                        <label className="block text-gray-400 mb-2 text-sm font-medium uppercase tracking-wider">
                          College Email{" "}
                          <span className="text-[var(--accent-red)]">*</span>
                        </label>
                        <div className="flex items-center">
                          <input
                            type="text"
                            value={emailPrefix}
                            onChange={(e) => {
                              const prefix = e.target.value;
                              if (prefix.includes("@")) {
                                setEmailError(
                                  "Enter username only (without @domain)",
                                );
                                setEmailStatus("invalid");
                                return;
                              }
                              setEmailError("");
                              setEmailPrefix(prefix);
                              setFormData({
                                ...formData,
                                collegeEmail: prefix + collegeEmailSuffix,
                              });
                              if (prefix.length > 0) {
                                setEmailStatus("checking");
                              } else {
                                setEmailStatus("idle");
                              }
                            }}
                            placeholder="Enter your college email"
                            className={`flex-1 bg-black/50 border text-white px-4 py-3 rounded-l-lg focus:outline-none focus:border-[var(--accent-green)] focus:ring-1 focus:ring-[var(--accent-green)] transition-all ${
                              emailStatus === "taken" ||
                              emailStatus === "invalid" ||
                              emailError
                                ? "border-red-500"
                                : emailStatus === "available"
                                  ? "border-green-500"
                                  : "border-gray-700"
                            }`}
                            required
                          />
                          <span className="bg-gray-800 text-gray-300 px-3 py-3 rounded-r-lg border border-l-0 border-gray-700 whitespace-nowrap">
                            {collegeEmailSuffix}
                          </span>
                        </div>
                        {emailStatus === "checking" && (
                          <div className="mt-2">
                            <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                        {emailStatus === "available" && !emailError && (
                          <p className="text-green-400 text-xs mt-1">
                            Email valid!
                          </p>
                        )}
                        {(emailStatus === "taken" || emailError) && (
                          <p className="text-red-400 text-xs mt-1">
                            {emailError || "Email already registered"}
                          </p>
                        )}
                      </div>
                    )}

                  {/* College Head: No branch (manages entire college) */}
                  {formData.role === "college_head" && (
                    <div className="bg-[var(--accent-green)]/10 border border-[var(--accent-green)]/20 p-4 rounded-lg">
                      <p className="text-[var(--accent-green)] text-sm">
                        As a College Head, you'll have access to all departments
                        in{" "}
                        {tenants.find((t) => t.id === formData.tenantId)
                          ?.name || "your college"}
                      </p>
                    </div>
                  )}

                  {/* College Email - Show for college_head after college selection */}
                  {formData.role === "college_head" && collegeEmailSuffix && (
                    <div className="mb-6">
                      <label className="block text-gray-400 mb-2 text-sm font-medium uppercase tracking-wider">
                        College Email{" "}
                        <span className="text-[var(--accent-red)]">*</span>
                      </label>
                      <div className="flex items-center">
                        <input
                          type="text"
                          value={emailPrefix}
                          onChange={(e) => {
                            const prefix = e.target.value;
                            if (prefix.includes("@")) {
                              setEmailError(
                                "Enter username only (without @domain)",
                              );
                              setEmailStatus("invalid");
                              return;
                            }
                            setEmailError("");
                            setEmailPrefix(prefix);
                            setFormData({
                              ...formData,
                              collegeEmail: prefix + collegeEmailSuffix,
                            });
                            if (prefix.length > 0) {
                              setEmailStatus("checking");
                            } else {
                              setEmailStatus("idle");
                            }
                          }}
                          placeholder="Enter your college email"
                          className={`flex-1 bg-black/50 border text-white px-4 py-3 rounded-l-lg focus:outline-none focus:border-[var(--accent-green)] focus:ring-1 focus:ring-[var(--accent-green)] transition-all ${
                            emailStatus === "taken" ||
                            emailStatus === "invalid" ||
                            emailError
                              ? "border-red-500"
                              : emailStatus === "available"
                                ? "border-green-500"
                                : "border-gray-700"
                          }`}
                          required
                        />
                        <span className="bg-gray-800 text-gray-300 px-3 py-3 rounded-r-lg border border-l-0 border-gray-700 whitespace-nowrap">
                          {collegeEmailSuffix}
                        </span>
                      </div>
                      {emailStatus === "checking" && (
                        <div className="mt-2">
                          <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                      {emailStatus === "available" && !emailError && (
                        <p className="text-green-400 text-xs mt-1">
                          Email valid!
                        </p>
                      )}
                      {(emailStatus === "taken" || emailError) && (
                        <p className="text-red-400 text-xs mt-1">
                          {emailError || "Email already registered"}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {formData.role !== "student" && formData.tenantId && (
                <div className="bg-[var(--accent-yellow)]/10 border border-[var(--accent-yellow)]/30 p-5 rounded-lg mt-4">
                  <p className="text-[var(--accent-yellow)] text-sm font-medium">
                    You'll be able to set up your specific branch details after
                    registration in the dashboard settings.
                  </p>
                </div>
              )}

              <div className="flex gap-4 mt-8">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 rounded-lg text-sm uppercase tracking-wider font-bold transition-all"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex-1 btn-green py-3 rounded-lg text-sm uppercase tracking-wider font-bold transition-all"
                >
                  Review Details &rarr;
                </button>
              </div>
            </>
          )}

          {/* Step 4: Review & Consent */}
          {step === 4 && (
            <>
              {/* Review Details Section */}
              <div className="bg-black/50 border border-white/5 p-4 rounded-lg mb-6">
                <h3 className="text-[var(--accent-green)] font-bold mb-4 uppercase tracking-wide text-xs">
                  Review Your Details
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Name *</span>
                    <span className="text-white font-medium">
                      {formData.fullName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Username *</span>
                    <span className="text-white font-medium">
                      @{formData.username}
                    </span>
                  </div>
                  {formData.personalEmail && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Personal Email *</span>
                      <span className="text-white font-medium">
                        {formData.personalEmail}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">College Email *</span>
                    <span className="text-white font-medium">
                      {formData.collegeEmail}
                    </span>
                  </div>
                  {formData.phone && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Phone</span>
                      <span className="text-white font-medium">
                        {formData.phone}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Role</span>
                    <span className="text-white font-medium capitalize">
                      {formData.role.replace("_", " ")}
                    </span>
                  </div>
                  {formData.role === "student" && formData.tenantId && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-400">College:</span>
                        <span className="text-white font-medium">
                          {
                            tenants.find((t) => t.id === formData.tenantId)
                              ?.name
                          }
                        </span>
                      </div>
                      {formData.courseId && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Course:</span>
                          <span className="text-white font-medium">
                            {
                              courses.find((c) => c.id === formData.courseId)
                                ?.name
                            }
                          </span>
                        </div>
                      )}
                      {formData.branchId && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Branch:</span>
                          <span className="text-white font-medium">
                            {
                              branches.find((b) => b.id === formData.branchId)
                                ?.name
                            }
                          </span>
                        </div>
                      )}
                      {formData.year && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Year:</span>
                          <span className="text-white font-medium">
                            {formData.year}
                            {getOrdinalSuffix(parseInt(formData.year))} Year
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-400">Batch:</span>
                        <span className="text-white font-medium">
                          {formData.batchStartYear} - {formData.batchEndYear}
                        </span>
                      </div>
                      {formData.enrollmentNumber && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Enrollment No *</span>
                          <span className="text-white font-medium">
                            {formData.enrollmentNumber}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  {(formData.role === "coordinator" ||
                    formData.role === "teacher") &&
                    formData.branchId && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Branch:</span>
                        <span className="text-white font-medium">
                          {
                            branches.find((b) => b.id === formData.branchId)
                              ?.name
                          }
                        </span>
                      </div>
                    )}
                </div>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-[var(--accent-yellow)] text-xs mt-3 hover:underline"
                >
                  Edit details
                </button>
              </div>

              {/* Terms and Privacy Policy */}
              <div className="space-y-4">
                <div className="bg-black/50 border border-white/5 p-4 rounded-lg mb-6">
                  <h3 className="text-[var(--accent-green)] font-bold mb-2 uppercase tracking-wide text-xs">
                    Privacy & Data Policy
                  </h3>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    TalentOS collects and processes your coding activity data
                    from connected platforms (LeetCode, Codeforces, GitHub,
                    etc.) to calculate trust scores and provide analytics.
                  </p>
                </div>

                <div className="bg-[var(--accent-yellow)]/10 border border-[var(--accent-yellow)]/30 p-4 rounded-lg mb-4">
                  <p className="text-[var(--accent-yellow)] text-sm">
                    <span className="font-bold">How to agree:</span> Click on
                    "Terms of Service" or "Privacy Policy" below, read through
                    to the end, and click "I Agree" to confirm your consent.
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div
                    className={`relative flex items-center mt-0.5 w-5 h-5 border-2 rounded ${formData.agreedToTerms ? "bg-[var(--accent-green)] border-[var(--accent-green)]" : "border-gray-600"} pointer-events-none`}
                  >
                    {formData.agreedToTerms && (
                      <svg
                        className="w-3 h-3 text-black"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-gray-300 text-sm">
                    I agree to the{" "}
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="text-[var(--accent-yellow)] hover:underline"
                    >
                      Terms of Service
                    </button>
                  </span>
                </div>

                <div className="flex items-start gap-4">
                  <div
                    className={`relative flex items-center mt-0.5 w-5 h-5 border-2 rounded ${formData.agreedToPrivacy ? "bg-[var(--accent-green)] border-[var(--accent-green)]" : "border-gray-600"} pointer-events-none`}
                  >
                    {formData.agreedToPrivacy && (
                      <svg
                        className="w-3 h-3 text-black"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-gray-300 text-sm">
                    I agree to the{" "}
                    <button
                      type="button"
                      onClick={() => setShowPrivacyModal(true)}
                      className="text-[var(--accent-yellow)] hover:underline"
                    >
                      Privacy Policy
                    </button>{" "}
                    and data processing
                  </span>
                </div>

                <label className="flex items-start gap-4 cursor-pointer group">
                  <div className="relative flex items-center mt-0.5">
                    <input
                      type="checkbox"
                      checked={formData.agreedToMonitoring}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          agreedToMonitoring: e.target.checked,
                        })
                      }
                      className="peer sr-only"
                    />
                    <div className="w-5 h-5 border-2 border-gray-600 rounded peer-checked:bg-[var(--accent-green)] peer-checked:border-[var(--accent-green)] transition-all"></div>
                  </div>
                  <span className="text-gray-300 text-sm group-hover:text-white transition-colors">
                    I consent to activity monitoring for trust score calculation
                    (optional - can be disabled later)
                  </span>
                </label>
              </div>

              <div className="bg-[var(--accent-red)]/5 border border-[var(--accent-red)]/20 p-4 rounded-lg mt-6">
                <p className="text-[var(--accent-red)] text-xs font-semibold uppercase tracking-wider">
                  Data Rights: You can request data deletion or export your data
                  at any time from settings.
                </p>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 rounded-lg text-sm uppercase tracking-wider font-bold transition-all"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={
                    loading ||
                    !formData.agreedToTerms ||
                    !formData.agreedToPrivacy
                  }
                  className="flex-1 btn-green py-3 rounded-lg text-sm uppercase tracking-wider font-bold transition-all disabled:opacity-50"
                >
                  {loading ? "Initializing Core..." : "Create Account"}
                </button>
              </div>
            </>
          )}
        </form>

        <p className="text-gray-500 mt-6 text-center text-sm font-medium">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-[var(--accent-yellow)] hover:text-yellow-400 transition-colors"
          >
            Sign In Access
          </Link>
        </p>
      </div>

      {/* Terms of Service Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">Terms of Service</h2>
              <button
                onClick={() => setShowTermsModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 text-gray-400 text-sm space-y-4">
              <p>
                <strong className="text-white">1. Acceptance of Terms</strong>
                <br />
                By accessing and using TalentOS, you accept and agree to be
                bound by the terms and provision of this agreement.
              </p>
              <p>
                <strong className="text-white">
                  2. Description of Service
                </strong>
                <br />
                TalentOS is a platform that tracks and analyzes coding activity
                from various competitive programming platforms to provide trust
                scores and analytics.
              </p>
              <p>
                <strong className="text-white">3. User Responsibilities</strong>
                <br />
                You agree to provide accurate information and maintain the
                security of your account credentials.
              </p>
              <p>
                <strong className="text-white">4. Privacy & Data</strong>
                <br />
                We collect and process your coding activity data as described in
                our Privacy Policy. You retain the right to request data
                deletion at any time.
              </p>
              <p>
                <strong className="text-white">
                  5. Trust Score Calculation
                </strong>
                <br />
                Trust scores are calculated based on connected platform data
                including problems solved, contest participation, and activity
                consistency.
              </p>
              <p>
                <strong className="text-white">6. Prohibited Use</strong>
                <br />
                You may not use the service for any unlawful purpose or attempt
                to manipulate trust scores through fraudulent means.
              </p>
              <p>
                <strong className="text-white">7. Account Termination</strong>
                <br />
                We reserve the right to terminate accounts that violate these
                terms or engage in fraudulent activity.
              </p>
              <p>
                <strong className="text-white">8. Disclaimer</strong>
                <br />
                TalentOS is provided "as is" without warranty of any kind. We do
                not guarantee the accuracy of platform data.
              </p>
              <p>
                <strong className="text-white">9. Changes to Terms</strong>
                <br />
                We may modify these terms at any time. Continued use constitutes
                acceptance of modified terms.
              </p>
              <p>
                <strong className="text-white">10. Contact</strong>
                <br />
                For questions about these terms, contact your institution
                administrator.
              </p>
            </div>
            <div className="p-4 border-t border-white/10">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsScrollAgreed}
                  onChange={(e) => setTermsScrollAgreed(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-600 text-[var(--accent-green)] focus:ring-[var(--accent-green)]"
                />
                <span className="text-gray-300 text-sm">
                  I have read and agree to the Terms of Service
                </span>
              </label>
              <button
                onClick={() => {
                  setFormData({ ...formData, agreedToTerms: true });
                  setShowTermsModal(false);
                }}
                disabled={!termsScrollAgreed}
                className="mt-4 w-full btn-green py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Accept Terms
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">Privacy Policy</h2>
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 text-gray-400 text-sm space-y-4">
              <p>
                <strong className="text-white">1. Data Collection</strong>
                <br />
                We collect coding activity data from platforms you choose to
                connect (LeetCode, Codeforces, CodeChef, GitHub, etc.) including
                problems solved, contest ratings, and repository information.
              </p>
              <p>
                <strong className="text-white">2. How We Use Your Data</strong>
                <br />
                Your data is used to calculate trust scores, provide analytics,
                generate leaderboards, and help institutions assess student
                performance.
              </p>
              <p>
                <strong className="text-white">3. Data Storage</strong>
                <br />
                Your data is stored securely in our database. We implement
                industry-standard security measures to protect your information.
              </p>
              <p>
                <strong className="text-white">4. Data Sharing</strong>
                <br />
                Your profile data may be visible to other users within your
                institution based on your privacy settings. Aggregated,
                anonymized data may be used for research.
              </p>
              <p>
                <strong className="text-white">5. Your Rights</strong>
                <br />
                You have the right to access your data, request corrections, and
                request deletion of your account and associated data at any
                time.
              </p>
              <p>
                <strong className="text-white">6. Platform Data</strong>
                <br />
                We fetch public data from connected platforms. We do not access
                private or protected information from these platforms.
              </p>
              <p>
                <strong className="text-white">7. Cookies & Tracking</strong>
                <br />
                We use essential cookies for authentication and session
                management. No third-party tracking cookies are used.
              </p>
              <p>
                <strong className="text-white">8. Children's Privacy</strong>
                <br />
                Our service is intended for college/institution students and
                staff. We do not knowingly collect data from minors.
              </p>
              <p>
                <strong className="text-white">9. Changes to Policy</strong>
                <br />
                We may update this policy periodically. We will notify you of
                significant changes.
              </p>
              <p>
                <strong className="text-white">10. Contact</strong>
                <br />
                For privacy concerns, contact your institution administrator or
                our support team.
              </p>
            </div>
            <div className="p-4 border-t border-white/10">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacyScrollAgreed}
                  onChange={(e) => setPrivacyScrollAgreed(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-600 text-[var(--accent-green)] focus:ring-[var(--accent-green)]"
                />
                <span className="text-gray-300 text-sm">
                  I have read and agree to the Privacy Policy
                </span>
              </label>
              <button
                onClick={() => {
                  setFormData({ ...formData, agreedToPrivacy: true });
                  setShowPrivacyModal(false);
                }}
                disabled={!privacyScrollAgreed}
                className="mt-4 w-full btn-green py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Accept Privacy Policy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="card-container max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--accent-yellow)]/20 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-[var(--accent-yellow)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white">
                  Confirm Account Creation
                </h2>
              </div>

              <div className="space-y-4 mb-6">
                <div className="bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/30 p-4 rounded-lg">
                  <p className="text-white font-semibold mb-2">
                    By creating an account, you agree to:
                  </p>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Terms of Service</li>
                    <li>• Privacy Policy and data processing</li>
                    <li>
                      • Activity monitoring for trust score calculation
                      (optional)
                    </li>
                  </ul>
                </div>

                <div className="text-gray-400 text-sm">
                  <p>
                    <strong className="text-white">Data Rights:</strong> You can
                    request data deletion or export your data at any time from
                    settings.
                  </p>
                </div>

                <div className="bg-[var(--accent-yellow)]/10 border border-[var(--accent-yellow)]/30 p-3 rounded-lg">
                  <p className="text-[var(--accent-yellow)] text-sm">
                    Please verify all details are correct before confirming.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setShowConfirmModal(false);
                    formRef.current?.requestSubmit();
                  }}
                  className="flex-1 btn-green py-3 rounded-lg font-bold"
                >
                  Confirm & Create Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
