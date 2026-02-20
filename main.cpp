#include <algorithm>
#include <array>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <queue>
#include <string>
#include <unordered_map>
#include <vector>
using namespace std;

struct Student {
    int roll = 0;
    string name, phone, address;
    int dsa = 0, os = 0, dbms = 0, cn = 0;
    int total = 0;
    double percentage = 0.0;
};

class StudentSystem {
private:
    vector<Student> students;
    unordered_map<int, size_t> rollToIndex;

    static void calculate(Student &s) {
        array<int, 4> marks = {s.dsa, s.os, s.dbms, s.cn};
        s.total = accumulate(marks.begin(), marks.end(), 0);
        s.percentage = static_cast<double>(s.total) / marks.size();
    }

public:
    bool addStudent(Student s) {
        if (rollToIndex.count(s.roll)) {
            return false;
        }

        calculate(s);
        rollToIndex[s.roll] = students.size();
        students.push_back(s);
        return true;
    }

    const Student *findByRoll(int roll) const {
        auto it = rollToIndex.find(roll);
        if (it == rollToIndex.end()) {
            return nullptr;
        }
        return &students[it->second];
    }

    vector<Student> leaderboard() const {
        vector<Student> ranked = students;
        stable_sort(ranked.begin(), ranked.end(), [](const Student &a, const Student &b) {
            if (a.total == b.total) {
                return a.roll < b.roll;
            }
            return a.total > b.total;
        });
        return ranked;
    }

    vector<Student> topK(int k) const {
        if (k <= 0 || students.empty()) {
            return {};
        }

        using Node = pair<int, size_t>;
        auto cmp = [](const Node &a, const Node &b) { return a.first > b.first; };
        priority_queue<Node, vector<Node>, decltype(cmp)> minHeap(cmp);

        for (size_t i = 0; i < students.size(); ++i) {
            minHeap.push({students[i].total, i});
            if (static_cast<int>(minHeap.size()) > k) {
                minHeap.pop();
            }
        }

        vector<size_t> idx;
        while (!minHeap.empty()) {
            idx.push_back(minHeap.top().second);
            minHeap.pop();
        }

        sort(idx.begin(), idx.end(), [this](size_t a, size_t b) {
            if (students[a].total == students[b].total) {
                return students[a].roll < students[b].roll;
            }
            return students[a].total > students[b].total;
        });

        vector<Student> result;
        for (size_t id : idx) {
            result.push_back(students[id]);
        }
        return result;
    }
};

static void printStudent(const Student &s) {
    cout << "Roll: " << s.roll << " | Name: " << s.name << " | Total: " << s.total << " | %: "
         << fixed << setprecision(2) << s.percentage << '\n';
}

int main() {
    StudentSystem system;

    system.addStudent({101, "Aman", "9876543210", "Delhi", 92, 88, 95, 90});
    system.addStudent({102, "Priya", "9876501234", "Lucknow", 85, 91, 89, 93});
    system.addStudent({103, "Rohit", "9876512345", "Jaipur", 96, 90, 92, 94});

    cout << "Advanced Student System Ready\n";

    const Student *found = system.findByRoll(102);
    if (found) {
        cout << "Found -> ";
        printStudent(*found);
    } else {
        cout << "Not found\n";
    }

    cout << "\nTop 2 Students:\n";
    for (const Student &s : system.topK(2)) {
        printStudent(s);
    }
}
