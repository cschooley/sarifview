# sarifview demo target file.
#
# This file is fixture data for fixtures/example.sarif. It exists so that
# copying the example SARIF into a workspace's .sarif/ directory produces
# findings that jump to a real file and line, instead of a path that
# doesn't exist. Nothing below is real code or a real vulnerability.

def example_finding_one():  # line 8 -> semgrep example finding (error)
    pass


def example_finding_two():  # line 12 -> semgrep example finding (warning)
    pass


def example_finding_three():  # line 16 -> semgrep example finding (note)
    pass


FAKE_API_KEY = "example-placeholder-not-a-real-key"     # line 20 -> gitleaks example finding (error)
FAKE_TOKEN = "example-placeholder-not-a-real-token"      # line 21 -> gitleaks example finding (warning)
